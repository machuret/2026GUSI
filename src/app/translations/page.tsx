"use client";

import { useState } from "react";
import { Languages, Settings, Sparkles, Upload, BookOpen } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { RulesPanel } from "./RulesPanel";
import { LibraryTab } from "./LibraryTab";
import { BulkUploadTab } from "./BulkUploadTab";
import { TranslateTab } from "./TranslateTab";
import { useTranslations } from "./hooks/useTranslations";
import { useRules } from "./hooks/useRules";

type PageTab = "translate" | "bulk" | "library";

const TABS: { id: PageTab; label: string; Icon: React.ElementType }[] = [
  { id: "translate", label: "Translate", Icon: Sparkles },
  { id: "bulk",      label: "Bulk Upload", Icon: Upload },
  { id: "library",   label: "Library", Icon: BookOpen },
];

export default function TranslationsPage() {
  const [pageTab, setPageTab] = useState<PageTab>("translate");
  const [showRules, setShowRules] = useState(false);

  const {
    translations, loading, error, actionError,
    setError, setActionError,
    fetchTranslations, addTranslation,
    handleStatusChange, handleSaveEdit, handleSaveRecheck, handleDelete,
  } = useTranslations();

  const {
    allRules, globalRules, rulesTab, rulesSaved,
    setGlobalRules, setRulesTab, setLangRules,
    getLangRules, buildCombinedRules, handleSaveRules,
  } = useRules();

  const langsWithRules = Object.keys(allRules).filter((k) => k !== "global" && allRules[k]?.trim());

  return (
    <div className="mx-auto max-w-5xl">
      {error && <ErrorBanner message={error} onRetry={fetchTranslations} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Languages className="h-8 w-8 text-brand-600" /> Translations
          </h1>
          <p className="mt-1 text-gray-500">
            Translate content with AI · bulk upload TXT files · manage approvals.
          </p>
          {langsWithRules.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">Custom rules active: {langsWithRules.join(", ")}</p>
          )}
        </div>
        <button
          onClick={() => setShowRules(!showRules)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${showRules ? "border-brand-300 bg-brand-50 text-brand-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
        >
          <Settings className="h-4 w-4" /> Translation Rules
        </button>
      </div>

      {/* Rules panel */}
      {showRules && (
        <RulesPanel
          allRules={allRules}
          globalRules={globalRules}
          rulesTab={rulesTab}
          rulesSaved={rulesSaved}
          setRulesTab={setRulesTab}
          setGlobalRules={setGlobalRules}
          setLangRules={setLangRules}
          getLangRules={getLangRules}
          buildCombinedRules={buildCombinedRules}
          onSave={handleSaveRules}
        />
      )}

      {/* Page tabs */}
      <div className="mb-5 flex border-b border-gray-300">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setPageTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${pageTab === id ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Icon className="h-4 w-4" />
            {label}
            {id === "library" && translations.length > 0 && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">{translations.length}</span>
            )}
          </button>
        ))}
      </div>

      {pageTab === "translate" && (
        <TranslateTab
          allRules={allRules}
          buildCombinedRules={buildCombinedRules}
          getLangRules={getLangRules}
          onSaved={addTranslation}
          onError={setActionError}
          onNavigateToLibrary={() => setPageTab("library")}
        />
      )}

      {pageTab === "bulk" && (
        <BulkUploadTab
          buildCombinedRules={buildCombinedRules}
          getLangRules={getLangRules}
          onSaved={addTranslation}
        />
      )}

      {pageTab === "library" && (
        <LibraryTab
          translations={translations}
          loading={loading}
          onStatusChange={handleStatusChange}
          onSaveEdit={handleSaveEdit}
          onSaveRecheck={handleSaveRecheck}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
