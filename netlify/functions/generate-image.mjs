// Це наш новий безпечний "посередник" (backend),
// який буде жити на сервері (наприклад, на Netlify).

// Обробник Netlify Function
export const handler = async (event, context) => {
    // Дозволяємо запити лише методом POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        // Отримуємо дані, які надіслав наш frontend (banner_generator.html)
        const { userPrompt, base64Data, mimeType, layout } = JSON.parse(event.body);
        
        // --- ОСЬ ТУТ ВІДБУВАЄТЬСЯ МАГІЯ БЕЗПЕКИ ---
        // Отримуємо API ключ з середовища Netlify (де він надійно зберігається)
        // Ви повинні встановити змінну `GEMINI_API_KEY` в налаштуваннях вашого сайту на Netlify
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            // Цю помилку буде видно лише в логах сервера
            console.error('API ключ не налаштовано на сервері.');
            throw new Error('Сервер не налаштовано.');
        }

        // Адреса Google API
        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;

        // Формуємо payload для Google API (так само, як ми робили це раніше на фронтенді)
        const parts = [
            { text: `Згенеруй високоякісне рекламне зображення. Це надзвичайно важливо: зображення повинно мати точний розмір ${layout.width} пікселів в ширину та ${layout.height} пікселів у висоту. Запит користувача: "${userPrompt}"` }
        ];
        if (base64Data) {
            parts.push({ inlineData: { mimeType, data: base64Data } });
        }
        const googlePayload = { 
            contents: [{ parts }], 
            generationConfig: { responseModalities: ['IMAGE'] } 
        };

        // Робимо запит до Google API (це відбувається на сервері, а не в браузері)
        const googleResponse = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(googlePayload)
        });

        if (!googleResponse.ok) {
            const errorText = await googleResponse.text();
            console.error('Google API Error:', errorText);
            throw new Error(`Помилка Google API: ${googleResponse.statusText}`);
        }

        const result = await googleResponse.json();
        const base64Image = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (!base64Image) {
            throw new Error('Не вдалося отримати зображення від Google API.');
        }

        // Відправляємо успішну відповідь (тільки потрібні дані) назад на наш frontend
        return {
            statusCode: 200,
            body: JSON.stringify({ base64Image: base64Image })
        };

    } catch (error) {
        console.error('Serverless Function Error:', error);
        // Відправляємо помилку назад на frontend, щоб користувач щось побачив
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Внутрішня помилка сервера' })
        };
    }
};
