export const VAPID_PUBLIC_KEY = "BFrbYjCaPRiAUYF-GLuK1i8LsD-z02e8ET9y3tYCO2j9Sw6KjaeXQ-xcDBRc3U0Z-B_kTKdzG1T07EioieE9Qg4";

export function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
