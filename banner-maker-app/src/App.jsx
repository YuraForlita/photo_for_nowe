import React, { useState, useRef } from 'react';

// --- ДАНІ МАКЕТІВ ---
// Тут ви (або адміністратор) можете визначити всі необхідні макети.
// Розміри (width, height) будуть передані в API для генерації.
const MOCK_LAYOUTS = [
  {
    id: 'main-desktop',
    name: 'Головний банер (Desktop)',
    format: 'desktop',
    width: 1920,
    height: 600,
  },
  {
    id: 'promo-square',
    name: 'Промо банер (Квадрат)',
    format: 'mobile/desktop',
    width: 1080,
    height: 1080,
  },
  {
    id: 'story-vertical',
    name: 'Банер для Story',
    format: 'mobile',
    width: 1080,
    height: 1920,
  },
  {
    id: 'category-banner',
    name: 'Банер категорії (Desktop)',
    format: 'desktop',
    width: 1200,
    height: 400,
  },
  {
    id: 'product-tile',
    name: 'Плитка товару (Акція)',
    format: 'mobile/desktop',
    width: 800,
    height: 800,
  },
  {
    id: 'side-banner-mobile',
    name: 'Боковий банер (Mobile)',
    format: 'mobile',
    width: 600,
    height: 1200,
  },
];

// --- ІКОНКИ (SVG) ---
// Маленький компонент для індикатора завантаження
const Spinner = () => (
  <svg
    className="animate-spin h-12 w-12 text-blue-600"
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

// Іконка для завантаження файлу
const UploadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 mr-2"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
    />
  </svg>
);

// Іконка для скачування
const DownloadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 mr-2"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

// --- КОМПОНЕНТ КАРТКИ МАКЕТУ ---
// Це "серце" логіки. Кожна картка керує своїм власним станом.
const LayoutCard = ({ name, width, height, format }) => {
  const [prompt, setPrompt] = useState('');
  const [inputImage, setInputImage] = useState(null); // base64 data for uploaded image
  const [generatedImage, setGeneratedImage] = useState(null); // base64 data from API
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);

  /**
   * Обробляє завантаження зображення користувачем.
   * Конвертує файл у base64 для відправки в API.
   */
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInputImage(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setInputImage(null);
    }
  };

  /**
   * Головна функція генерації.
   * Використовує 'gemini-2.5-flash-image-preview' (nano-banana) для image-to-image.
   */
  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null); // Очищуємо попередній результат

    // Формуємо повний запит для API
    let fullPrompt = `Generate a banner image based on the following description: "${prompt}".
The final image MUST be exactly ${width} pixels wide and ${height} pixels tall.
Ensure the aspect ratio is precisely ${width}:${height}.`;

    if (inputImage) {
      fullPrompt += ` Use the uploaded image as a strong reference or starting point, modifying it as needed to fit the description and dimensions.`;
    } else {
      fullPrompt += ` Generate a new image from scratch based on the description.`;
    }

    // Готуємо частини запиту
    const parts = [{ text: fullPrompt }];
    if (inputImage) {
      try {
        const mimeType = inputImage.match(/data:(image\/[a-z]+);base64,/)[1];
        const base64Data = inputImage.split(',')[1];
        parts.push({
          inlineData: {
            mimeType: mimeType || 'image/png',
            data: base64Data,
          },
        });
      } catch (e) {
        console.error("Error processing input image:", e);
        setError("Невірний формат завантаженого зображення.");
        setIsLoading(false);
        return;
      }
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['IMAGE'], // Ми просимо тільки зображення
      },
    };

    // ЦЕ ОНОВЛЕНИЙ РЯДОК, ЯКИЙ ЧИТАЄ КЛЮЧ
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;

    // Логіка запиту з повторними спробами (exponential backoff)
    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        // Повторюємо спробу при помилках сервера або 429
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }

        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg = errorData.error?.message || `API error: ${response.status}`;
          throw new Error(errorMsg); // Виходимо, якщо це не помилка для повтору
        }

        const result = await response.json();
        const base64Data = result?.candidates?.[0]?.content?.parts?.find(
          (p) => p.inlineData
        )?.inlineData?.data;

        if (base64Data) {
          setGeneratedImage(`data:image/png;base64,${base64Data}`);
          setIsLoading(false);
          return; // Успіх! Виходимо з функції.
        } else {
          // Якщо відповідь 200, але зображення немає (напр. спрацював safety filter)
          const textResponse = result?.candidates?.[0]?.content?.parts?.find(
            (p) => p.text
          )?.text;
          throw new Error(textResponse || "API не повернуло зображення. Можливо, запит було заблоковано.");
        }

      } catch (err) {
        console.error(`Attempt failed: ${err.message}`);
        retries--;
        if (retries === 0 || err.message.includes("API error")) {
          // Якщо спроби закінчились або це була помилка, яку не треба повторювати
          setError(`Помилка генерації: ${err.message}`);
          setIsLoading(false);
          return;
        }
        // Чекаємо перед наступною спробою
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      }
    }
    
    // Якщо цикл завершився без успіху
    setError("Не вдалося згенерувати зображення після кількох спроб.");
    setIsLoading(false);
  };

  /**
   * Дозволяє користувачу завантажити згенероване зображення.
   */
  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    // Формуємо ім'я файлу
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `${safeName}_${width}x${height}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Стиль для дотримання пропорцій макету
  const aspectRatioStyle = {
    aspectRatio: `${width} / ${height}`,
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl">
      {/* --- Заголовок картки --- */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-800">{name}</h3>
        <p className="text-sm text-gray-500">
          {format} | {width}px × {height}px
        </p>
      </div>

      {/* --- Область перегляду (плейсхолдер/результат) --- */}
      <div
        className="w-full bg-gray-100 relative overflow-hidden"
        style={aspectRatioStyle}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 backdrop-blur-sm">
            <Spinner />
          </div>
        )}
        
        {!isLoading && !generatedImage && inputImage && (
           <img
            src={inputImage}
            alt="Завантажене зображення"
            className="w-full h-full object-contain"
          />
        )}

        {generatedImage && (
          <img
            src={generatedImage}
            alt="Згенерований банер"
            className="w-full h-full object-cover"
          />
        )}

        {!isLoading && !generatedImage && !inputImage && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 italic p-4 text-center">
            Тут з'явиться згенерований банер
          </div>
        )}
      </div>

      {/* --- Повідомлення про помилку --- */}
      {error && (
        <div className="p-4 bg-red-100 text-red-700 text-sm font-medium m-4 rounded-md">
          {error}
        </div>
      )}

      {/* --- Контрольна панель --- */}
      <div className="p-4 flex-grow flex flex-col space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Опишіть банер (наприклад: 'Акція -50% на фени, рожевий фон...')"
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          rows="3"
          disabled={isLoading}
        />

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Кнопка "Додати зображення" */}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
            disabled={isLoading}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            disabled={isLoading}
            className="flex-1 w-full flex items-center justify-center p-3 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
          >
            <UploadIcon />
            {inputImage ? 'Змінити фото' : 'Додати фото'}
          </button>
          
          {/* Кнопка "Очистити фото" */}
          {inputImage && (
             <button
              onClick={() => {
                setInputImage(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-3 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300 transition disabled:opacity-50 text-sm"
            >
              Очистити фото
            </button>
          )}
        </div>
        
        {/* Кнопки дій */}
        <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-gray-200">
           <button
            onClick={handleGenerate}
            disabled={!prompt || isLoading}
            className="w-full flex items-center justify-center p-4 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 transition disabled:bg-gray-400 disabled:shadow-none"
          >
            {isLoading ? 'Генерація...' : 'Згенерувати'}
          </button>

          <div className="flex gap-3">
             <button
              onClick={() => {
                setGeneratedImage(null);
                setError(null);
              }}
              disabled={!generatedImage || isLoading}
              className="flex-1 w-full p-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition disabled:opacity-50 disabled:bg-gray-300"
            >
              Очистити
            </button>
            <button
              onClick={handleDownload}
              disabled={!generatedImage || isLoading}
              className="flex-1 w-full flex items-center justify-center p-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:bg-gray-300"
            >
              <DownloadIcon />
              Завантажити
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- ГОЛОВНИЙ КОМПОНЕНТ ДОДАТКУ ---
const App = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Майстерня Банерів
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Оберіть макет, опишіть ідею та згенеруйте банер за допомогою Gemini.
        </p>

        {/* --- Сітка макетів --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_LAYOUTS.map((layout) => (
            <LayoutCard
              key={layout.id}
              name={layout.name}
              width={layout.width}
              height={layout.height}
              format={layout.format}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;

