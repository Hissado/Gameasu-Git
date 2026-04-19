import React, { useRef, useState } from "react";
import { uploadFiles, mediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
}

export function PhotoUploader({ value, onChange, max = 10, label = "Photos" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (value.length + files.length > max) {
      toast({ variant: "destructive", title: "Trop de photos", description: `Maximum ${max} photos.` });
      return;
    }
    setUploading(true);
    try {
      const { urls } = await uploadFiles(files);
      onChange([...value, ...urls]);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Échec de l'upload", description: err.message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{label}</label>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading || value.length >= max}>
          {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Camera className="w-4 h-4 mr-1.5" />}
          Ajouter
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSelect} />
      </div>
      {value.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-md py-8 text-center text-sm text-muted-foreground">
          Aucune photo. Cliquez sur "Ajouter" pour téléverser.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {value.map((url, i) => (
            <div key={i} className="relative group aspect-square border border-border rounded-md overflow-hidden bg-slate-50">
              <img src={mediaUrl(url)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
