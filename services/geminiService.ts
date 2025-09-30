
// Dynamically import the SDK to keep it out of the initial bundle
// and instantiate the client only when needed.
let genAiClient: any | null = null;
async function getGenAi() {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }
  if (!genAiClient) {
    const mod: any = await import("@google/genai");
    genAiClient = new mod.GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return genAiClient;
}

export const editImageWithNanoBanana = async (
  base64ImageData: string,
  mimeType: string,
  prompt: string,
  maskBase64?: string | null,
  maskMimeType?: string | null
): Promise<string> => {
  try {
    const parts: any[] = [
      {
        inlineData: {
          data: base64ImageData,
          mimeType: mimeType,
        },
      },
    ];

    if (maskBase64 && maskMimeType) {
      parts.push({
        inlineData: {
          data: maskBase64,
          mimeType: maskMimeType,
        },
      });
    }

    parts.push({ text: prompt });

    const ai = await getGenAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      const errorMessage = `Request blocked due to ${blockReason}. Please modify your prompt or image.`;
      console.error(errorMessage, "Full API Response:", response);
      throw new Error(errorMessage);
    }

    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePart?.inlineData) {
      return imagePart.inlineData.data;
    }

    console.error("Invalid API Response: No image data found in the response.", response);
    throw new Error("The model did not return an image. Please try a different prompt.");

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      // Re-throw the original error to be caught by the UI
      throw error;
    }
    // For non-Error objects thrown
    throw new Error("An unknown error occurred during the Gemini API call.");
  }
};
