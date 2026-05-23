import React from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function AIAutomation() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold mb-8">Intelligence Artificielle et Automatisation</h1>
        <p className="text-xl text-muted-foreground">This is the AI & Automation page.</p>
      </div>
    </div>
  );
}
