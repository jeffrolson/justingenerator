
export async function sendTelegramMessage(botToken: string, chatId: string, message: string) {
    if (!botToken || !chatId) {
        console.warn('Telegram credentials not found, skipping notification');
        return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to send Telegram message:', response.status, errorText);
        } else {
            console.log('Telegram notification sent successfully');
        }
    } catch (error) {
        console.error('Error sending Telegram message:', error);
    }
}
