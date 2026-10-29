"use client";

import { useState } from "react";
import Link from "next/link";
import { useMessages } from "@/i18n/I18nProvider";
import { seoHelperTitleGeneratorMessages } from "@/i18n/messages/seo-helper-title-generator";

interface GeneratedTitle {
  title: string;
  length: number;
  isOptimal: boolean;
}

interface GeneratedDescription {
  description: string;
  length: number;
  isOptimal: boolean;
}

export default function TitleGeneratorPage() {
  const t = useMessages(seoHelperTitleGeneratorMessages);
  const [keyword, setKeyword] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<"professional" | "casual" | "urgent" | "informative">("professional");
  const [titles, setTitles] = useState<GeneratedTitle[]>([]);
  const [descriptions, setDescriptions] = useState<GeneratedDescription[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"titles" | "descriptions">("titles");

  const generateTitles = () => {
    if (!keyword.trim()) return;
    
    setIsGenerating(true);
    
    // Simuliere AI-Generierung mit vordefinierten Patterns
    setTimeout(() => {
      const patterns = getTitlePatterns(t, keyword.trim(), topic.trim(), tone);
      const generatedTitles = patterns.map(title => ({
        title,
        length: title.length,
        isOptimal: title.length >= 50 && title.length <= 60,
      }));
      setTitles(generatedTitles);
      
      const descPatterns = getDescriptionPatterns(t, keyword.trim(), topic.trim(), tone);
      const generatedDescs = descPatterns.map(desc => ({
        description: desc,
        length: desc.length,
        isOptimal: desc.length >= 150 && desc.length <= 160,
      }));
      setDescriptions(generatedDescs);
      
      setIsGenerating(false);
    }, 800);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/seo-helper"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t.keywordLabel}
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t.keywordPlaceholder}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t.topicLabel}
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t.topicPlaceholder}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t.toneLabel}
          </label>
          <div className="flex flex-wrap gap-2">
            {(["professional", "casual", "urgent", "informative"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setTone(value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tone === value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {t.tones[value]}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generateTitles}
          disabled={!keyword.trim() || isGenerating}
          className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t.generating}
            </span>
          ) : (
            t.generate
          )}
        </button>
      </div>

      {/* Results Section */}
      {(titles.length > 0 || descriptions.length > 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("titles")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "titles"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.titleTagsTab(titles.length)}
            </button>
            <button
              onClick={() => setActiveTab("descriptions")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "descriptions"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.metaDescriptionsTab(descriptions.length)}
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {activeTab === "titles" ? (
              titles.map((item, index) => (
                <ResultCard
                  key={index}
                  text={item.title}
                  length={item.length}
                  isOptimal={item.isOptimal}
                  optimalRange="50-60"
                  onCopy={() => copyToClipboard(item.title)}
                />
              ))
            ) : (
              descriptions.map((item, index) => (
                <ResultCard
                  key={index}
                  text={item.description}
                  length={item.length}
                  isOptimal={item.isOptimal}
                  optimalRange="150-160"
                  onCopy={() => copyToClipboard(item.description)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">{t.bestPracticesTitle}</h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>{t.bestPractices.titleLabel}</strong> {t.bestPractices.titleText}</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>{t.bestPractices.descriptionLabel}</strong> {t.bestPractices.descriptionText}</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>{t.bestPractices.uniqueLabel}</strong> {t.bestPractices.uniqueText}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function ResultCard({ 
  text, 
  length, 
  isOptimal, 
  optimalRange, 
  onCopy 
}: { 
  text: string; 
  length: number; 
  isOptimal: boolean; 
  optimalRange: string;
  onCopy: () => void;
}) {
  const t = useMessages(seoHelperTitleGeneratorMessages);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
      <p className="text-slate-900 dark:text-white mb-3">{text}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            isOptimal 
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
          }`}>
            {t.characters(length)}
          </span>
          <span className="text-xs text-slate-500">
            {t.optimal(optimalRange)}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t.copied}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {t.copy}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Helper functions for generating titles and descriptions
type TitleGeneratorTexts = (typeof seoHelperTitleGeneratorMessages)["de"];
type Tone = keyof TitleGeneratorTexts["titlePatterns"];

function getTitlePatterns(t: TitleGeneratorTexts, keyword: string, topic: string, tone: Tone): string[] {
  const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  const year = new Date().getFullYear();

  let results = (t.titlePatterns[tone] || t.titlePatterns.professional)(capitalizedKeyword, year);
  
  // Add topic-specific variations if topic is provided
  if (topic) {
    results = results.map((title, index) => {
      if (index === 0) return t.titleWithTopic(capitalizedKeyword, topic, year);
      return title;
    });
  }

  return results;
}

function getDescriptionPatterns(t: TitleGeneratorTexts, keyword: string, topic: string, tone: Tone): string[] {
  const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  const year = new Date().getFullYear();

  const results = (t.descriptionPatterns[tone] || t.descriptionPatterns.professional)(keyword, capitalizedKeyword, year);
  
  if (topic) {
    results[0] = t.descriptionWithTopic(capitalizedKeyword, topic);
  }

  return results;
}
