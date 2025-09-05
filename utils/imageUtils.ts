const loadImage = (base64: string, mimeType: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = `data:${mimeType};base64,${base64}`;
    });
};

export const combineImagesSideBySide = async (
    base64ImageA: string, mimeTypeA: string,
    base64ImageB: string, mimeTypeB: string
): Promise<string> => {
    const [imgA, imgB] = await Promise.all([
        loadImage(base64ImageA, mimeTypeA),
        loadImage(base64ImageB, mimeTypeB),
    ]);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get canvas context');
    }

    // Make canvas tall enough for the taller image, and wide enough for both
    canvas.width = imgA.width + imgB.width;
    canvas.height = Math.max(imgA.height, imgB.height);

    // Clear canvas and draw images
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw image A, centered vertically if it's shorter
    const yA = (canvas.height - imgA.height) / 2;
    ctx.drawImage(imgA, 0, yA);
    // Draw image B, centered vertically if it's shorter
    const yB = (canvas.height - imgB.height) / 2;
    ctx.drawImage(imgB, imgA.width, yB);
    
    // Add a separator line
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(imgA.width, 0);
    ctx.lineTo(imgA.width, canvas.height);
    ctx.stroke();

    // Return as base64 png
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
};
