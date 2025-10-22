// Це основний обробник безсерверної функції
// Він працює на Deno runtime (Netlify Functions v2), тому 'fetch' доступний глобально.
export const handler = async (event, context) => {

  // --- 1. Діагностика методу ---
  // Ми очікуємо ТІЛЬКИ 'POST' запити.
  if (event.httpMethod !== "POST") {
    console.warn(`Отримано невірний метод: ${event.httpMethod}`);
    return {
      statusCode: 405, // 405 = Method Not Allowed
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
      body: JSON.stringify({
        error: `Метод не дозволено. Отримано '${event.httpMethod}', але очікувався 'POST'.`
      }),
    };
  }

  // --- 2. Отримання API ключа ---
  // Ключ береться з налаштувань Netlify (Environment variables)
  // Deno використовує Deno.env.get()
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    console.error("GEMINI_API_KEY не знайдено. Перевірте змінні середовища Netlify.");
    return {
      statusCode: 500, // 500 = Internal Server Error
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: "Помилка конфігурації сервера: API ключ не знайдено."
      }),
    };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;

  try {
    // --- 3. Обробка запиту від клієнта ---
    // Тіло запиту (body) від Netlify приходить у вигляді рядка (string).
    // Нам потрібно його розпарсити як JSON.
    const clientPayload = JSON.parse(event.body);

    // Створюємо тіло запиту для Google API.
    const googleApiPayload = {
      contents: clientPayload.contents,
      generationConfig: {
        responseModalities: ['IMAGE']
      },
      systemInstruction: clientPayload.systemInstruction
    };

    // --- 4. Запит до Google API ---
    // Використовуємо вбудований 'fetch'
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleApiPayload),
    });

    // --- 5. Обробка відповіді від Google ---
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Помилка від Google API:", response.status, errorText);
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Помилка від Google API: ${errorText}`
        }),
      };
    }

    const data = await response.json();

    // --- 6. Успішна відповідь клієнту ---
    // Повертаємо дані у тому ж форматі, який очікує наш фронтенд
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };

  } catch (error) {
    // --- 7. Обробка загальних помилок (наприклад, невірний JSON) ---
    console.error("Загальна помилка у функції:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: `Внутрішня помилка сервера: ${error.message}`
      }),
    };
  }
};

