import React, { useState } from 'react';

// --- Початкові дані для макетів ---
// Ви можете редагувати цей список, щоб додати, видалити або змінити макети
const initialLayouts = [
  {
    name: 'Головний банер',
    format: 'desktop',
    dimensions: '1920x600',
    orientation: 'горизонтальна',
  },
  {
    name: 'Промо банер (Квадрат)',
    format: 'desktop/mobile',
    dimensions: '1080x1080',
    orientation: 'квадратна',
  },
  {
    name: 'Банер категорії (Мобільний)',
    format: 'mobile',
    dimensions: '800x1200',
    orientation: 'вертикальна',
  },
  {
    name: 'Банер для Email',
    format: 'desktop',
    dimensions: '600x300',
    orientation: 'горизонтальна',
  },
];

// --- Компонент-спіннер для завантаження ---
const LoadingSpinner = () => (
  <svg
    className="animate-spin h-12 w-12 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

// --- Основний компонент картки для одного макета ---
const LayoutCard = ({ layout }) => {
  const { name, format, dimensions, orientation } = layout;
  const [width, height] = dimensions.split('x').map(Number);

  // Стан для кожного окремого макета
  const [prompt, setPrompt] = useState('');
  const [inputImageFile, setInputImageFile] = useState(null); // Зберігаємо об'єкт File
  const [inputImageBase64, setInputImageBase64] = useState(null); // Зберігаємо Data URL
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Обробник завантаження файлу
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setInputImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setInputImageBase64(reader.result); // Це буде data:image/...;base64,...
      };
      reader.readAsDataURL(file);
    }
  };

  // Функція для скасування вибору зображення
  const clearInputImage = () => {
    setInputImageFile(null);
    setInputImageBase64(null);
    // Скидаємо значення інпуту, щоб можна було обрати той самий файл знову
    document.getElementById(`file-input-${name}`).value = null;
  };

  // --- Функція генерації зображення ---
  const handleGenerate = async () => {
    if (!prompt) {
      setError('Будь ласка, введіть текстовий запит.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null); // Очищуємо попередній результат

    // Залишаємо API-ключ порожнім, Canvas надасть його
    const apiKey = 'AIzaSyCmWMkZ4_M1VvXwt1HXVxXiwPUvotwt0ws';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;

    // Збираємо "частини" запиту
    const parts = [];

    // 1. Текстова частина (завжди присутня)
    // Додаємо деталі макета до запиту користувача
    const fullPrompt = `Запит користувача: "${prompt}". Згенеруй це як ${orientation} банер з цільовими розмірами ${dimensions}.`;
    parts.push({ text: fullPrompt });

    // 2. Частина з зображенням (якщо завантажено)
    if (inputImageBase64) {
      try {
        // Отримуємо чистий base64 та mimeType з data URL
        const [header, base64Data] = inputImageBase64.split(',');
        const mimeType = header.match(/:(.*?);/)[1];
        parts.push({ inlineData: { mimeType, data: base64Data } });
      } catch (e) {
        console.error('Error processing input image:', e);
        setError('Не вдалося обробити завантажене зображення.');
        setIsLoading(false);
        return;
      }
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        // Ми не можемо *змусити* модель дати точні розміри,
        // але ми вказали їх у текстовому запиті.
      },
    };

    // Логіка запиту до API з повторними спробами
    let response;
    let retries = 3;
    let delay = 1000;

    for (let i = 0; i < retries; i++) {
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          // Знаходимо частину з зображенням у відповіді
          const b64Data = result?.candidates?.[0]?.content?.parts?.find(
            (p) => p.inlineData
          )?.inlineData?.data;

          if (b64Data) {
            setGeneratedImage(`data:image/png;base64,${b64Data}`);
            break; // Успіх, виходимо з циклу
          } else {
            throw new Error('У відповіді API відсутнє зображення.');
          }
        } else {
          // Якщо відповідь не 'ok', спробуємо ще
          throw new Error(`API error: ${response.statusText}`);
        }
      } catch (err) {
        console.error(`Attempt ${i + 1} failed:`, err);
        if (i === retries - 1) {
          setError(
            `Не вдалося згенерувати зображення після ${retries} спроб. ${err.message}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Експоненційна затримка
      }
    }
    setIsLoading(false);
  };

  // --- Функція завантаження готового зображення ---
  const handleDownload = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    // Формуємо ім'я файлу
    const safeName = name.replace(/ /g, '_');
    const safePrompt = prompt.slice(0, 20).replace(/ /g, '_') || 'banner';
    link.download = `${safeName}-${safePrompt}.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row transition-all duration-300">
      {/* --- Ліва частина: Вікно перегляду (Placeholder) --- */}
      <div
        className="relative md:w-1/2 flex-shrink-0 bg-gray-700 rounded-t-2xl md:rounded-l-2xl md:rounded-t-none"
        // Використовуємо CSS aspect-ratio для збереження пропорцій
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {/* Умовний рендеринг */}
          {!generatedImage && !isLoading && (
            <div className="text-center text-gray-400">
              <span className="block text-2xl font-semibold">{name}</span>
              <span className="block text-lg font-mono">
                {dimensions} px
              </span>
              <span className="block text-sm capitalize text-gray-500">
                ({format} / {orientation})
              </span>
            </div>
          )}

          {isLoading && <LoadingSpinner />}

          {generatedImage && !isLoading && (
            <img
              src={generatedImage}
              alt="Generated Banner"
              className="absolute inset-0 w-full h-full object-contain" // object-contain, щоб бачити все зображення
            />
          )}
        </div>
      </div>

      {/* --- Права частина: Елементи керування --- */}
      <div className="md:w-1/2 p-6 flex flex-col gap-4 justify-between">
        <div className="flex flex-col gap-4">
          <h3 className="text-2xl font-bold text-white">{name}</h3>
          
          {/* Поле для текстового запиту */}
          <div>
            <label
              htmlFor={`prompt-${name}`}
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Запит для генерації
            </label>
            <textarea
              id={`prompt-${name}`}
              rows="3"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              placeholder="Напр.: Банер -50% на фени, рожевий фон..."
            ></textarea>
          </div>

          {/* Поле для завантаження зображення */}
          <div>
            <label
              htmlFor={`file-input-${name}`}
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Додати зображення (опціонально)
            </label>
            <input
              type="file"
              id={`file-input-${name}`}
              accept="image/png, image/jpeg"
              onChange={handleImageUpload}
              disabled={isLoading}
              className="hidden" // Ховаємо стандартний інпут
            />
            {/* Стилізована кнопка/лейбл */}
            <label
              htmlFor={`file-input-${name}`}
              className={`cursor-pointer w-full text-center py-2 px-4 rounded-lg transition-colors text-white ${
                isLoading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Обрати файл
            </label>
            {/* Відображення обраного файлу + кнопка скасування */}
            {inputImageFile && (
              <div className="text-sm text-gray-400 mt-2 flex justify-between items-center">
                <span>Файл: {inputImageFile.name}</span>
                <button
                  onClick={clearInputImage}
                  disabled={isLoading}
                  className="text-red-400 hover:text-red-300 text-xs font-bold"
                  title="Скасувати вибір"
                >
                  [ X ]
                </button>
              </div>
            )}
          </div>
          
          {/* Повідомлення про помилку */}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* --- Кнопки дій --- */}
        <div className="flex flex-col gap-3 mt-4">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt}
            className="w-full py-3 px-5 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? 'Генерація...'
              : generatedImage
              ? 'Згенерувати ще раз'
              : 'Згенерувати'}
          </button>

          {generatedImage && !isLoading && (
            <button
              onClick={handleDownload}
              className="w-full py-2 px-4 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 transition-all"
            >
              Завантажити
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Головний компонент додатка ---
export default function App() {
  const [layouts, setLayouts] = useState(initialLayouts);

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            Генератор Макетів Банерів
          </h1>
          <p className="text-lg text-gray-300">
            Створюйте графічні елементи на основі текстових запитів та макетів.
          </p>
        </header>

        {/* Сітка з макетами */}
        <main className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          {layouts.map((layout) => (
            <LayoutCard key={layout.name} layout={layout} />
          ))}
        </main>
      </div>
    </div>
  );
}
