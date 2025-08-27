import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ObjectUploader({
  maxFileSize = 5242880, // 5MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize) {
      alert(`Le fichier est trop volumineux. Taille maximum: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }

    try {
      setUploading(true);
      console.log('🔄 Début upload pour:', file.name);
      
      // Get upload parameters
      const uploadParams = await onGetUploadParameters();
      console.log('✅ Paramètres d\'upload reçus:', uploadParams);
      
      // Upload file directly
      const response = await fetch(uploadParams.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      console.log('📤 Réponse upload:', response.status, response.statusText);

      if (response.ok) {
        const responseData = await response.text();
        console.log('✅ Upload réussi, réponse:', responseData);
        
        // Simulate Uppy result format
        const result = {
          successful: [{
            uploadURL: uploadParams.url,
            name: file.name
          }]
        };
        onComplete?.(result);
      } else {
        const errorText = await response.text();
        console.error('❌ Erreur upload:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('💥 Erreur complète:', error);
      alert(`Erreur lors de l'upload: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div>
      <Button 
        type="button" 
        onClick={handleButtonClick} 
        className={buttonClassName}
        disabled={uploading}
      >
        {uploading ? 'Upload en cours...' : children}
      </Button>
      
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}