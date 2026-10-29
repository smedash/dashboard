"use client";

import { useState } from "react";
import Link from "next/link";
import { useMessages } from "@/i18n/I18nProvider";
import { seoHelperSchemaGeneratorMessages } from "@/i18n/messages/seo-helper-schema-generator";

type SchemaType = "faq" | "howto" | "article" | "product" | "localbusiness" | "breadcrumb" | "financialproduct" | "bank" | "definedterm" | "collectionpage";

interface FAQItem {
  question: string;
  answer: string;
}

interface HowToStep {
  name: string;
  text: string;
}

interface CollectionItem {
  name: string;
  url: string;
  description: string;
}

export default function SchemaGeneratorPage() {
  const t = useMessages(seoHelperSchemaGeneratorMessages);
  const [schemaType, setSchemaType] = useState<SchemaType>("faq");
  const [generatedSchema, setGeneratedSchema] = useState("");
  const [copied, setCopied] = useState(false);

  // FAQ State
  const [faqItems, setFaqItems] = useState<FAQItem[]>([
    { question: "", answer: "" },
  ]);

  // HowTo State
  const [howToTitle, setHowToTitle] = useState("");
  const [howToDescription, setHowToDescription] = useState("");
  const [howToSteps, setHowToSteps] = useState<HowToStep[]>([
    { name: "", text: "" },
  ]);

  // Article State
  const [articleTitle, setArticleTitle] = useState("");
  const [articleDescription, setArticleDescription] = useState("");
  const [articleAuthor, setArticleAuthor] = useState("");
  const [articlePublishDate, setArticlePublishDate] = useState("");
  const [articleImage, setArticleImage] = useState("");

  // Product State
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCurrency, setProductCurrency] = useState("CHF");
  const [productAvailability, setProductAvailability] = useState("InStock");
  const [productImage, setProductImage] = useState("");

  // LocalBusiness State
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("LocalBusiness");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessPostal, setBusinessPostal] = useState("");
  const [businessCountry, setBusinessCountry] = useState("CH");
  const [businessPhone, setBusinessPhone] = useState("");

  // Breadcrumb State
  const [breadcrumbs, setBreadcrumbs] = useState(() => [
    { name: t.breadcrumb.homeDefault, url: "https://www.beispiel.ch" },
    { name: "", url: "" },
  ]);

  // FinancialProduct State
  const [finProductName, setFinProductName] = useState("");
  const [finProductDescription, setFinProductDescription] = useState("");
  const [finProductType, setFinProductType] = useState("FinancialProduct");
  const [finProductProvider, setFinProductProvider] = useState("");
  const [finProductInterestRate, setFinProductInterestRate] = useState("");
  const [finProductAnnualRate, setFinProductAnnualRate] = useState("");
  const [finProductUrl, setFinProductUrl] = useState("");

  // BankOrCreditUnion State
  const [bankName, setBankName] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [bankCity, setBankCity] = useState("");
  const [bankPostal, setBankPostal] = useState("");
  const [bankCountry, setBankCountry] = useState("CH");
  const [bankPhone, setBankPhone] = useState("");
  const [bankUrl, setBankUrl] = useState("");
  const [bankOpeningHours, setBankOpeningHours] = useState("");

  // DefinedTerm State
  const [termName, setTermName] = useState("");
  const [termDescription, setTermDescription] = useState("");
  const [termCode, setTermCode] = useState("");
  const [termSetName, setTermSetName] = useState("");
  const [termSetUrl, setTermSetUrl] = useState("");

  // CollectionPage State
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionUrl, setCollectionUrl] = useState("");
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([
    { name: "", url: "", description: "" },
  ]);

  const schemaTypes: { value: SchemaType; label: string; description: string }[] = [
    { value: "faq", label: "FAQ", description: t.typeDescriptions.faq },
    { value: "howto", label: "HowTo", description: t.typeDescriptions.howto },
    { value: "article", label: "Article", description: t.typeDescriptions.article },
    { value: "product", label: "Product", description: t.typeDescriptions.product },
    { value: "localbusiness", label: "LocalBusiness", description: t.typeDescriptions.localbusiness },
    { value: "breadcrumb", label: "Breadcrumb", description: t.typeDescriptions.breadcrumb },
    { value: "financialproduct", label: "FinancialProduct", description: t.typeDescriptions.financialproduct },
    { value: "bank", label: "Bank", description: t.typeDescriptions.bank },
    { value: "definedterm", label: "DefinedTerm", description: t.typeDescriptions.definedterm },
    { value: "collectionpage", label: "CollectionPage", description: t.typeDescriptions.collectionpage },
  ];

  const generateSchema = () => {
    let schema: object = {};

    switch (schemaType) {
      case "faq":
        schema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqItems
            .filter(item => item.question && item.answer)
            .map(item => ({
              "@type": "Question",
              "name": item.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
              }
            }))
        };
        break;

      case "howto":
        schema = {
          "@context": "https://schema.org",
          "@type": "HowTo",
          "name": howToTitle,
          "description": howToDescription,
          "step": howToSteps
            .filter(step => step.name && step.text)
            .map((step, index) => ({
              "@type": "HowToStep",
              "position": index + 1,
              "name": step.name,
              "text": step.text
            }))
        };
        break;

      case "article":
        schema = {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": articleTitle,
          "description": articleDescription,
          "author": {
            "@type": "Person",
            "name": articleAuthor
          },
          "datePublished": articlePublishDate,
          ...(articleImage && { "image": articleImage })
        };
        break;

      case "product":
        schema = {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": productName,
          "description": productDescription,
          ...(productImage && { "image": productImage }),
          "offers": {
            "@type": "Offer",
            "price": productPrice,
            "priceCurrency": productCurrency,
            "availability": `https://schema.org/${productAvailability}`
          }
        };
        break;

      case "localbusiness":
        schema = {
          "@context": "https://schema.org",
          "@type": businessType,
          "name": businessName,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": businessAddress,
            "addressLocality": businessCity,
            "postalCode": businessPostal,
            "addressCountry": businessCountry
          },
          ...(businessPhone && { "telephone": businessPhone })
        };
        break;

      case "breadcrumb":
        schema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": breadcrumbs
            .filter(item => item.name && item.url)
            .map((item, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "name": item.name,
              "item": item.url
            }))
        };
        break;

      case "financialproduct":
        schema = {
          "@context": "https://schema.org",
          "@type": finProductType,
          "name": finProductName,
          "description": finProductDescription,
          ...(finProductProvider && {
            "provider": {
              "@type": "Organization",
              "name": finProductProvider
            }
          }),
          ...(finProductInterestRate && { "interestRate": parseFloat(finProductInterestRate) }),
          ...(finProductAnnualRate && { "annualPercentageRate": parseFloat(finProductAnnualRate) }),
          ...(finProductUrl && { "url": finProductUrl })
        };
        break;

      case "bank":
        schema = {
          "@context": "https://schema.org",
          "@type": "BankOrCreditUnion",
          "name": bankName,
          ...(bankDescription && { "description": bankDescription }),
          "address": {
            "@type": "PostalAddress",
            "streetAddress": bankAddress,
            "addressLocality": bankCity,
            "postalCode": bankPostal,
            "addressCountry": bankCountry
          },
          ...(bankPhone && { "telephone": bankPhone }),
          ...(bankUrl && { "url": bankUrl }),
          ...(bankOpeningHours && { "openingHours": bankOpeningHours })
        };
        break;

      case "definedterm":
        schema = {
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          "name": termName,
          "description": termDescription,
          ...(termCode && { "termCode": termCode }),
          ...(termSetUrl ? {
            "inDefinedTermSet": {
              "@type": "DefinedTermSet",
              "name": termSetName || undefined,
              "url": termSetUrl
            }
          } : termSetName ? { "inDefinedTermSet": termSetName } : {})
        };
        break;

      case "collectionpage": {
        const filteredItems = collectionItems.filter(item => item.name && item.url);
        schema = {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": collectionName,
          ...(collectionDescription && { "description": collectionDescription }),
          ...(collectionUrl && { "url": collectionUrl }),
          ...(filteredItems.length > 0 && {
            "mainEntity": {
              "@type": "ItemList",
              "itemListElement": filteredItems.map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": item.name,
                "url": item.url,
                ...(item.description && { "description": item.description })
              }))
            }
          })
        };
        break;
      }
    }

    setGeneratedSchema(JSON.stringify(schema, null, 2));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addFaqItem = () => {
    setFaqItems([...faqItems, { question: "", answer: "" }]);
  };

  const removeFaqItem = (index: number) => {
    setFaqItems(faqItems.filter((_, i) => i !== index));
  };

  const addHowToStep = () => {
    setHowToSteps([...howToSteps, { name: "", text: "" }]);
  };

  const removeHowToStep = (index: number) => {
    setHowToSteps(howToSteps.filter((_, i) => i !== index));
  };

  const addBreadcrumb = () => {
    setBreadcrumbs([...breadcrumbs, { name: "", url: "" }]);
  };

  const removeBreadcrumb = (index: number) => {
    setBreadcrumbs(breadcrumbs.filter((_, i) => i !== index));
  };

  const addCollectionItem = () => {
    setCollectionItems([...collectionItems, { name: "", url: "", description: "" }]);
  };

  const removeCollectionItem = (index: number) => {
    setCollectionItems(collectionItems.filter((_, i) => i !== index));
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
        <div className="p-3 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Schema Type Selector */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">{t.chooseType}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {schemaTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSchemaType(type.value)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    schemaType === type.value
                      ? "bg-pink-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  <div className="font-medium text-sm">{type.label}</div>
                  <div className={`text-xs ${schemaType === type.value ? "text-pink-200" : "text-slate-500"}`}>
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Form based on Schema Type */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">{t.enterData}</h2>

            {/* FAQ Form */}
            {schemaType === "faq" && (
              <div className="space-y-4">
                {faqItems.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t.faq.question(index + 1)}
                      </span>
                      {faqItems.length > 1 && (
                        <button
                          onClick={() => removeFaqItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          {t.remove}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={t.faq.questionPlaceholder}
                      value={item.question}
                      onChange={(e) => {
                        const newItems = [...faqItems];
                        newItems[index].question = e.target.value;
                        setFaqItems(newItems);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <textarea
                      placeholder={t.faq.answerPlaceholder}
                      value={item.answer}
                      onChange={(e) => {
                        const newItems = [...faqItems];
                        newItems[index].answer = e.target.value;
                        setFaqItems(newItems);
                      }}
                      rows={2}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                ))}
                <button
                  onClick={addFaqItem}
                  className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-pink-500 hover:text-pink-500 transition-colors"
                >
                  {t.faq.add}
                </button>
              </div>
            )}

            {/* HowTo Form */}
            {schemaType === "howto" && (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder={t.howto.titlePlaceholder}
                  value={howToTitle}
                  onChange={(e) => setHowToTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
                <textarea
                  placeholder={t.howto.descriptionPlaceholder}
                  value={howToDescription}
                  onChange={(e) => setHowToDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                />
                {howToSteps.map((step, index) => (
                  <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t.howto.step(index + 1)}
                      </span>
                      {howToSteps.length > 1 && (
                        <button onClick={() => removeHowToStep(index)} className="text-red-500 hover:text-red-700 text-sm">
                          {t.remove}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={t.howto.stepTitlePlaceholder}
                      value={step.name}
                      onChange={(e) => {
                        const newSteps = [...howToSteps];
                        newSteps[index].name = e.target.value;
                        setHowToSteps(newSteps);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <textarea
                      placeholder={t.howto.stepDescriptionPlaceholder}
                      value={step.text}
                      onChange={(e) => {
                        const newSteps = [...howToSteps];
                        newSteps[index].text = e.target.value;
                        setHowToSteps(newSteps);
                      }}
                      rows={2}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                ))}
                <button
                  onClick={addHowToStep}
                  className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-pink-500 hover:text-pink-500 transition-colors"
                >
                  {t.howto.add}
                </button>
              </div>
            )}

            {/* Article Form */}
            {schemaType === "article" && (
              <div className="space-y-4">
                <input type="text" placeholder={t.article.titlePlaceholder} value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder={t.article.descriptionPlaceholder} value={articleDescription} onChange={(e) => setArticleDescription(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <input type="text" placeholder={t.article.authorPlaceholder} value={articleAuthor} onChange={(e) => setArticleAuthor(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <input type="date" placeholder={t.article.publishDatePlaceholder} value={articlePublishDate} onChange={(e) => setArticlePublishDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <input type="text" placeholder={t.imageUrlOptional} value={articleImage} onChange={(e) => setArticleImage(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
              </div>
            )}

            {/* Product Form */}
            {schemaType === "product" && (
              <div className="space-y-4">
                <input type="text" placeholder={t.product.namePlaceholder} value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder={t.product.descriptionPlaceholder} value={productDescription} onChange={(e) => setProductDescription(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder={t.product.pricePlaceholder} value={productPrice} onChange={(e) => setProductPrice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <select value={productCurrency} onChange={(e) => setProductCurrency(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <select value={productAvailability} onChange={(e) => setProductAvailability(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="InStock">{t.product.availability.InStock}</option>
                  <option value="OutOfStock">{t.product.availability.OutOfStock}</option>
                  <option value="PreOrder">{t.product.availability.PreOrder}</option>
                </select>
                <input type="text" placeholder={t.imageUrlOptional} value={productImage} onChange={(e) => setProductImage(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
              </div>
            )}

            {/* LocalBusiness Form */}
            {schemaType === "localbusiness" && (
              <div className="space-y-4">
                <input type="text" placeholder={t.business.namePlaceholder} value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="LocalBusiness">{t.business.types.LocalBusiness}</option>
                  <option value="Restaurant">{t.business.types.Restaurant}</option>
                  <option value="Store">{t.business.types.Store}</option>
                  <option value="MedicalBusiness">{t.business.types.MedicalBusiness}</option>
                  <option value="FinancialService">{t.business.types.FinancialService}</option>
                </select>
                <input type="text" placeholder={t.address.street} value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder={t.address.postal} value={businessPostal} onChange={(e) => setBusinessPostal(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <input type="text" placeholder={t.address.city} value={businessCity} onChange={(e) => setBusinessCity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                </div>
                <input type="tel" placeholder={t.address.phoneOptional} value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
              </div>
            )}

            {/* Breadcrumb Form */}
            {schemaType === "breadcrumb" && (
              <div className="space-y-4">
                {breadcrumbs.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 w-6">{index + 1}.</span>
                    <input
                      type="text"
                      placeholder={t.breadcrumb.name}
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...breadcrumbs];
                        newItems[index].name = e.target.value;
                        setBreadcrumbs(newItems);
                      }}
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="URL"
                      value={item.url}
                      onChange={(e) => {
                        const newItems = [...breadcrumbs];
                        newItems[index].url = e.target.value;
                        setBreadcrumbs(newItems);
                      }}
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    {breadcrumbs.length > 1 && (
                      <button onClick={() => removeBreadcrumb(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addBreadcrumb}
                  className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-pink-500 hover:text-pink-500 transition-colors"
                >
                  {t.breadcrumb.add}
                </button>
              </div>
            )}

            {/* FinancialProduct Form */}
            {schemaType === "financialproduct" && (
              <div className="space-y-4">
                <select value={finProductType} onChange={(e) => setFinProductType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="FinancialProduct">{t.finProduct.types.FinancialProduct}</option>
                  <option value="LoanOrCredit">{t.finProduct.types.LoanOrCredit}</option>
                  <option value="BankAccount">{t.finProduct.types.BankAccount}</option>
                  <option value="InvestmentOrDeposit">{t.finProduct.types.InvestmentOrDeposit}</option>
                  <option value="PaymentCard">{t.finProduct.types.PaymentCard}</option>
                  <option value="CurrencyConversionService">{t.finProduct.types.CurrencyConversionService}</option>
                </select>
                <input type="text" placeholder={t.finProduct.namePlaceholder} value={finProductName} onChange={(e) => setFinProductName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder={t.finProduct.descriptionPlaceholder} value={finProductDescription} onChange={(e) => setFinProductDescription(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <input type="text" placeholder={t.finProduct.providerPlaceholder} value={finProductProvider} onChange={(e) => setFinProductProvider(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t.finProduct.interestRate}</label>
                    <input type="number" step="0.01" placeholder={t.finProduct.interestRatePlaceholder} value={finProductInterestRate} onChange={(e) => setFinProductInterestRate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t.finProduct.annualRate}</label>
                    <input type="number" step="0.01" placeholder={t.finProduct.annualRatePlaceholder} value={finProductAnnualRate} onChange={(e) => setFinProductAnnualRate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  </div>
                </div>
                <input type="url" placeholder={t.finProduct.urlPlaceholder} value={finProductUrl} onChange={(e) => setFinProductUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
              </div>
            )}

            {/* BankOrCreditUnion Form */}
            {schemaType === "bank" && (
              <div className="space-y-4">
                <input type="text" placeholder={t.bank.namePlaceholder} value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder={t.bank.descriptionPlaceholder} value={bankDescription} onChange={(e) => setBankDescription(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <input type="text" placeholder={t.address.street} value={bankAddress} onChange={(e) => setBankAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder={t.address.postal} value={bankPostal} onChange={(e) => setBankPostal(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <input type="text" placeholder={t.address.city} value={bankCity} onChange={(e) => setBankCity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                </div>
                <select value={bankCountry} onChange={(e) => setBankCountry(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="CH">{t.bank.countries.CH}</option>
                  <option value="DE">{t.bank.countries.DE}</option>
                  <option value="AT">{t.bank.countries.AT}</option>
                  <option value="LI">{t.bank.countries.LI}</option>
                </select>
                <input type="tel" placeholder={t.address.phoneOptional} value={bankPhone} onChange={(e) => setBankPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <input type="url" placeholder={t.bank.websitePlaceholder} value={bankUrl} onChange={(e) => setBankUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t.bank.openingHours}</label>
                  <input type="text" placeholder={t.bank.openingHoursPlaceholder} value={bankOpeningHours} onChange={(e) => setBankOpeningHours(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                </div>
              </div>
            )}

            {/* DefinedTerm Form */}
            {schemaType === "definedterm" && (
              <div className="space-y-4">
                <input type="text" placeholder={t.term.namePlaceholder} value={termName} onChange={(e) => setTermName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder={t.term.descriptionPlaceholder} value={termDescription} onChange={(e) => setTermDescription(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <input type="text" placeholder={t.term.codePlaceholder} value={termCode} onChange={(e) => setTermCode(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t.term.setHeading}</span>
                  <input type="text" placeholder={t.term.setNamePlaceholder} value={termSetName} onChange={(e) => setTermSetName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <input type="url" placeholder={t.term.setUrlPlaceholder} value={termSetUrl} onChange={(e) => setTermSetUrl(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                </div>
              </div>
            )}

            {/* CollectionPage Form */}
            {schemaType === "collectionpage" && (
              <div className="space-y-4">
                <input type="text" placeholder={t.collection.namePlaceholder} value={collectionName} onChange={(e) => setCollectionName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />
                <textarea placeholder={t.collection.descriptionPlaceholder} value={collectionDescription} onChange={(e) => setCollectionDescription(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white resize-none" />
                <input type="url" placeholder={t.collection.urlPlaceholder} value={collectionUrl} onChange={(e) => setCollectionUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" />

                <div className="pt-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t.collection.itemsHeading}</span>
                </div>

                {collectionItems.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t.collection.item(index + 1)}
                      </span>
                      {collectionItems.length > 1 && (
                        <button
                          onClick={() => removeCollectionItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          {t.remove}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={t.collection.itemNamePlaceholder}
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...collectionItems];
                        newItems[index].name = e.target.value;
                        setCollectionItems(newItems);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <input
                      type="url"
                      placeholder={t.collection.itemUrlPlaceholder}
                      value={item.url}
                      onChange={(e) => {
                        const newItems = [...collectionItems];
                        newItems[index].url = e.target.value;
                        setCollectionItems(newItems);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder={t.collection.itemDescriptionPlaceholder}
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...collectionItems];
                        newItems[index].description = e.target.value;
                        setCollectionItems(newItems);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                ))}
                <button
                  onClick={addCollectionItem}
                  className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-pink-500 hover:text-pink-500 transition-colors"
                >
                  {t.collection.add}
                </button>
              </div>
            )}

            <button
              onClick={generateSchema}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transition-all"
            >
              {t.generate}
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">{t.outputHeading}</h2>
            {generatedSchema && (
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
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
            )}
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 min-h-[400px]">
            {generatedSchema ? (
              <pre className="text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
                <code>{`<script type="application/ld+json">\n${generatedSchema}\n</script>`}</code>
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <p>{t.outputPlaceholder}</p>
              </div>
            )}
          </div>

          {/* Integration Hint */}
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-200 dark:border-pink-800">
            <h3 className="font-medium text-pink-900 dark:text-pink-100 mb-2">{t.integrationHeading}</h3>
            <p className="text-sm text-pink-800 dark:text-pink-200">
              {t.integrationBefore}<code className="bg-pink-100 dark:bg-pink-800 px-1 rounded">&lt;head&gt;</code>{t.integrationAfter}<a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" className="underline hover:text-pink-600">Google Rich Results Test</a>{t.integrationEnd}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
