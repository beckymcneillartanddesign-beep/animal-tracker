import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

/* ---------- constants ---------- */

const STORAGE_KEYS = {
  wildlifeEntries: "abe_wildlife_entries_v1",
  dogEntries: "abe_dog_entries_v1",
  shelterEntries: "abe_shelter_entries_v1",
  wildlifeInsights: "abe_wildlife_insights_v1",
  dogInsights: "abe_dog_insights_v1",
  shelterInsights: "abe_shelter_insights_v1",
};

const cameraIds = ["B1", "L1", "L2"];
const cameraSpots = ["Backyard tree", "Woods edge", "Game trail", "Waterfront"];
const locationTypes = ["Town", "Lake"];
const wildlifeSpecies = [
  "Gray Squirrel",
  "Red Squirrel",
  "Fox",
  "Raccoon",
  "Opossum",
  "Black Bear",
  "Skunk",
  "Porcupine",
  "Deer",
  "Coyote",
  "Beaver",
  "Mink/Weasel/Fisher",
  "Otter",
  "Groundhog",
  "Rabbit",
  "Chipmunk",
];
const wildlifeBehaviors = [
  "Traveling",
  "Feeding / Foraging",
  "Investigating",
  "Resting",
  "Interacting",
  "Unknown",
];
const timeCategories = ["Dawn", "Day", "Dusk", "Night"];
const weatherOptions = ["Clear", "Cloudy", "Rain", "Snow", "Windy"];
const temperatureRanges = ["<30°F", "30–50°F", "50–70°F", "70–90°F", "90°F+"];
const animalCounts = ["1", "2", "3", "4+"];

const dogSettings = [
  "Living room (quiet)",
  "Living room (active)",
  "Kitchen",
  "Bedroom",
  "Outside",
];
const dogComfort = ["High", "Medium", "Low"];
const dogEngagement = ["High", "Medium", "Low"];
const dogStress = ["None", "Mild", "Moderate"];
const yesNo = ["Yes", "No"];
const cueOptions = ["Yes", "No", "Didn’t try"];
const dogConditionSuggestions = [
  "sitting near human",
  "playing with human",
  "using enrichment toy",
  "resting",
  "alone briefly",
  "family activity nearby",
];

const shelterEnergy = ["Low", "Medium", "High"];
const shelterVoice = ["Third person", "First person"];
const shelterBestHomeFitOptions = [
  "Fenced yard required",
  "No small children",
  "Single pet home",
  "Good with dogs",
  "Good with cats",
  "Needs experienced owner",
  "Apartment friendly",
  "Active home needed",
  "Calm/quiet home",
  "Needs time to adjust",
  "Low-traffic home",
  "Older kids only",
  "Someone home often",
  "Confident adopter preferred",
  "First-time owner friendly",
];
const shelterCardStyles = [
  { value: "classic-blue", label: "Classic Blue" },
  { value: "ocean-blue", label: "Ocean Blue" },
  { value: "soft-indigo", label: "Soft Indigo" },
];
const shelterLikesSuggestions = [
  "treats",
  "soft voices",
  "tennis balls",
  "gentle pets",
  "sniff walks",
  "cozy beds",
  "being near people",
  "playtime",
];
const shelterTraitSuggestions = [
  "making soulful eye contact",
  "leaning in for affection",
  "trotting over with quiet excitement",
  "melting for treats and praise",
  "making people smile immediately",
];

/* ---------- helpers ---------- */

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
}

function downloadCSV(filename, rows) {
  if (!rows || !rows.length) return;

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );

  const escape = (value) => {
    const str = value == null ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function countTopSpecies(entries) {
  const counts = {};
  for (const entry of entries) {
    for (const sp of entry.speciesObserved || []) {
      counts[sp] = (counts[sp] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : "—";
}

function toTitleStyle(value) {
  return (value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function resizeImageToDataUrl(file, maxSize = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height >= width && height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function appendSuggestion(existing, suggestion) {
  const base = (existing || "").trim();
  if (!base) return suggestion;
  const pieces = base.split(",").map((p) => p.trim());
  if (pieces.includes(suggestion)) return base;
  return `${base}, ${suggestion}`;
}

function generateShelterProfile(entry) {
  const {
    name,
    age,
    energyLevel,
    voice,
    likes,
    bestHomeFit,
    memorableTrait,
  } = entry;

  const safeName = name?.trim() || "This dog";
  const safeAge = age?.trim() || "unknown age";
  const safeEnergy = (energyLevel || "Medium").toLowerCase();
  const safeLikes = likes?.trim() || "treats, gentle attention, and being near people";
  const safeHome =
    bestHomeFit && bestHomeFit.length
      ? bestHomeFit.join(", ")
      : "a calm home with patient people";
  const safeTrait =
    memorableTrait?.trim() || "making sweet eye contact that feels like instant connection";

  if (voice === "First person") {
    return `Hi, I’m ${safeName}. I’m ${safeAge} with a ${safeEnergy}-energy personality. I love ${safeLikes}. I would likely do best in ${safeHome}. My special gift is ${safeTrait}.`;
  }

  return `${safeName} is ${safeAge} with a ${safeEnergy}-energy personality. ${safeName} loves ${safeLikes}. ${safeName} would likely do best in ${safeHome}. A memorable trait is ${safeTrait}.`;
}

function cardStyleColors(value) {
  switch (value) {
    case "ocean-blue":
      return {
        outer: "linear-gradient(135deg, #0f172a 0%, #0ea5e9 100%)",
        accentBg: "#e0f2fe",
        accentText: "#0c4a6e",
        border: "#bae6fd",
      };
    case "soft-indigo":
      return {
        outer: "linear-gradient(135deg, #312e81 0%, #60a5fa 100%)",
        accentBg: "#e0e7ff",
        accentText: "#312e81",
        border: "#c7d2fe",
      };
    case "classic-blue":
    default:
      return {
        outer: "linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)",
        accentBg: "#dbeafe",
        accentText: "#1e3a8a",
        border: "#bfdbfe",
      };
  }
}

/* ---------- blank forms ---------- */

function blankWildlifeForm() {
  return {
    id: null,
    date: "",
    time: "",
    timeCategory: "",
    locationType: "",
    cameraId: "",
    cameraSpot: "",
    speciesObserved: [],
    totalAnimals: "",
    behavior: "",
    weather: "",
    temperatureRange: "",
    photo: "",
    notes: "",
  };
}

function blankDogForm() {
  return {
    id: null,
    date: "",
    time: "",
    setting: "",
    condition: "",
    comfort: "",
    engagement: "",
    stress: "",
    usedEnrichment: "",
    respondedToCue: "",
    notes: "",
  };
}

function blankShelterForm() {
  return {
    id: null,
    name: "",
    age: "",
    energyLevel: "",
    voice: "Third person",
    likes: "",
    bestHomeFit: [],
    memorableTrait: "",
    bandanaDone: "",
    photoDone: "",
    storyDone: "",
    profileUpdateDate: "",
    adoptionDate: "",
    cardStyle: "classic-blue",
    photo: "",
    notes: "",
  };
}

function blankWildlifeInsightForm() {
  return {
    id: null,
    entryDate: "",
    observationStartDate: "",
    observationEndDate: "",
    mostCommonAnimal: "",
    mostActiveTime: "",
    townVsLakeDifferences: "",
    behaviorPattern: "",
    summarySentence: "",
  };
}

function blankDogInsightForm() {
  return {
    id: null,
    entryDate: "",
    observationStartDate: "",
    observationEndDate: "",
    mostRelaxedCondition: "",
    stressPattern: "",
    enrichmentEffect: "",
    engagementPattern: "",
    summarySentence: "",
  };
}

function blankShelterInsightForm() {
  return {
    id: null,
    entryDate: "",
    observationStartDate: "",
    observationEndDate: "",
    quickestAdoptions: "",
    profileWordingPattern: "",
    visualPattern: "",
    bestHomeFitPattern: "",
    summarySentence: "",
  };
}

/* ---------- small UI pieces ---------- */

function SectionButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.navButton,
        ...(active ? styles.navButtonActive : {}),
      }}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }) {
  return <label style={styles.label}>{children}</label>;
}

function TextInput(props) {
  return <input {...props} style={{ ...styles.input, ...(props.style || {}) }} />;
}

function SelectInput(props) {
  return <select {...props} style={{ ...styles.input, ...(props.style || {}) }} />;
}

function TextArea(props) {
  return <textarea {...props} style={{ ...styles.textarea, ...(props.style || {}) }} />;
}

function PrimaryButton({ children, onClick, type = "button", style = {} }) {
  return (
    <button type={type} onClick={onClick} style={{ ...styles.primaryButton, ...style }}>
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, type = "button", style = {} }) {
  return (
    <button type={type} onClick={onClick} style={{ ...styles.secondaryButton, ...style }}>
      {children}
    </button>
  );
}

function PillButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.pill,
        ...(active ? styles.pillActive : {}),
      }}
    >
      {children}
    </button>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryTitle}>{title}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

/* ---------- main app ---------- */

export default function App() {
  const [activeTab, setActiveTab] = useState("home");

  const [wildlifeEntries, setWildlifeEntries] = useState(() =>
    loadJSON(STORAGE_KEYS.wildlifeEntries, [])
  );
  const [dogEntries, setDogEntries] = useState(() =>
    loadJSON(STORAGE_KEYS.dogEntries, [])
  );
  const [shelterEntries, setShelterEntries] = useState(() =>
    loadJSON(STORAGE_KEYS.shelterEntries, [])
  );
  const [wildlifeInsights, setWildlifeInsights] = useState(() =>
    loadJSON(STORAGE_KEYS.wildlifeInsights, [])
  );
  const [dogInsights, setDogInsights] = useState(() =>
    loadJSON(STORAGE_KEYS.dogInsights, [])
  );
  const [shelterInsights, setShelterInsights] = useState(() =>
    loadJSON(STORAGE_KEYS.shelterInsights, [])
  );

  const [wildlifeForm, setWildlifeForm] = useState(blankWildlifeForm);
  const [dogForm, setDogForm] = useState(blankDogForm);
  const [shelterForm, setShelterForm] = useState(blankShelterForm);
  const [wildlifeInsightForm, setWildlifeInsightForm] = useState(blankWildlifeInsightForm);
  const [dogInsightForm, setDogInsightForm] = useState(blankDogInsightForm);
  const [shelterInsightForm, setShelterInsightForm] = useState(blankShelterInsightForm);

  const cardPreviewRef = useRef(null);

  useEffect(() => saveJSON(STORAGE_KEYS.wildlifeEntries, wildlifeEntries), [wildlifeEntries]);
  useEffect(() => saveJSON(STORAGE_KEYS.dogEntries, dogEntries), [dogEntries]);
  useEffect(() => saveJSON(STORAGE_KEYS.shelterEntries, shelterEntries), [shelterEntries]);
  useEffect(() => saveJSON(STORAGE_KEYS.wildlifeInsights, wildlifeInsights), [wildlifeInsights]);
  useEffect(() => saveJSON(STORAGE_KEYS.dogInsights, dogInsights), [dogInsights]);
  useEffect(() => saveJSON(STORAGE_KEYS.shelterInsights, shelterInsights), [shelterInsights]);

  const homeSummary = useMemo(() => {
    const topSpecies = countTopSpecies(wildlifeEntries);
    const townSightings = wildlifeEntries.filter((e) => e.locationType === "Town").length;
    const lakeSightings = wildlifeEntries.filter((e) => e.locationType === "Lake").length;

    return {
      wildlifeCount: wildlifeEntries.length,
      dogCount: dogEntries.length,
      shelterCount: shelterEntries.length,
      topSpecies,
      townSightings,
      lakeSightings,
    };
  }, [wildlifeEntries, dogEntries, shelterEntries]);

  const shelterProfilePreview = useMemo(
    () => generateShelterProfile(shelterForm),
    [shelterForm]
  );

  async function handleWildlifePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImageToDataUrl(file);
    setWildlifeForm((prev) => ({ ...prev, photo: dataUrl }));
  }

  async function handleShelterPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImageToDataUrl(file);
    setShelterForm((prev) => ({ ...prev, photo: dataUrl, photoDone: "Yes" }));
  }

  function toggleWildlifeSpecies(species) {
    setWildlifeForm((prev) => {
      const current = prev.speciesObserved || [];
      const exists = current.includes(species);
      return {
        ...prev,
        speciesObserved: exists
          ? current.filter((s) => s !== species)
          : [...current, species],
      };
    });
  }

  function toggleBestHomeFit(option) {
    setShelterForm((prev) => {
      const current = prev.bestHomeFit || [];
      const exists = current.includes(option);
      return {
        ...prev,
        bestHomeFit: exists ? current.filter((o) => o !== option) : [...current, option],
      };
    });
  }

  function saveWildlifeEntry() {
    if (
      !wildlifeForm.date ||
      !wildlifeForm.time ||
      !wildlifeForm.timeCategory ||
      !wildlifeForm.locationType ||
      !wildlifeForm.cameraId ||
      !wildlifeForm.cameraSpot ||
      !wildlifeForm.speciesObserved.length ||
      !wildlifeForm.totalAnimals ||
      !wildlifeForm.behavior ||
      !wildlifeForm.weather
    ) {
      alert("Please complete the required wildlife fields before saving.");
      return;
    }

    const payload = {
      ...wildlifeForm,
      id: wildlifeForm.id || uid(),
    };

    setWildlifeEntries((prev) => {
      const exists = prev.some((entry) => entry.id === payload.id);
      return exists
        ? prev.map((entry) => (entry.id === payload.id ? payload : entry))
        : [payload, ...prev];
    });

    setWildlifeForm(blankWildlifeForm());
  }

  function saveDogEntry() {
    if (
      !dogForm.date ||
      !dogForm.time ||
      !dogForm.setting ||
      !dogForm.condition ||
      !dogForm.comfort ||
      !dogForm.engagement ||
      !dogForm.stress ||
      !dogForm.usedEnrichment ||
      !dogForm.respondedToCue
    ) {
      alert("Please complete the required dog fields before saving.");
      return;
    }

    const payload = {
      ...dogForm,
      id: dogForm.id || uid(),
    };

    setDogEntries((prev) => {
      const exists = prev.some((entry) => entry.id === payload.id);
      return exists
        ? prev.map((entry) => (entry.id === payload.id ? payload : entry))
        : [payload, ...prev];
    });

    setDogForm(blankDogForm());
  }

  function saveShelterEntry() {
    if (
      !shelterForm.name ||
      !shelterForm.age ||
      !shelterForm.energyLevel ||
      !shelterForm.likes ||
      !shelterForm.memorableTrait ||
      !shelterForm.profileUpdateDate
    ) {
      alert("Please complete the required shelter fields before saving.");
      return;
    }

    const payload = {
      ...shelterForm,
      id: shelterForm.id || uid(),
      generatedProfile: generateShelterProfile(shelterForm),
    };

    setShelterEntries((prev) => {
      const exists = prev.some((entry) => entry.id === payload.id);
      return exists
        ? prev.map((entry) => (entry.id === payload.id ? payload : entry))
        : [payload, ...prev];
    });

    setShelterForm(blankShelterForm());
  }

  function saveWildlifeInsight() {
    if (
      !wildlifeInsightForm.entryDate ||
      !wildlifeInsightForm.observationStartDate ||
      !wildlifeInsightForm.observationEndDate
    ) {
      alert("Please complete the dated fields before saving wildlife insights.");
      return;
    }

    const payload = {
      ...wildlifeInsightForm,
      id: wildlifeInsightForm.id || uid(),
    };

    setWildlifeInsights((prev) => {
      const exists = prev.some((entry) => entry.id === payload.id);
      return exists
        ? prev.map((entry) => (entry.id === payload.id ? payload : entry))
        : [payload, ...prev];
    });

    setWildlifeInsightForm(blankWildlifeInsightForm());
  }

  function saveDogInsight() {
    if (
      !dogInsightForm.entryDate ||
      !dogInsightForm.observationStartDate ||
      !dogInsightForm.observationEndDate
    ) {
      alert("Please complete the dated fields before saving dog insights.");
      return;
    }

    const payload = {
      ...dogInsightForm,
      id: dogInsightForm.id || uid(),
    };

    setDogInsights((prev) => {
      const exists = prev.some((entry) => entry.id === payload.id);
      return exists
        ? prev.map((entry) => (entry.id === payload.id ? payload : entry))
        : [payload, ...prev];
    });

    setDogInsightForm(blankDogInsightForm());
  }

  function saveShelterInsight() {
    if (
      !shelterInsightForm.entryDate ||
      !shelterInsightForm.observationStartDate ||
      !shelterInsightForm.observationEndDate
    ) {
      alert("Please complete the dated fields before saving shelter insights.");
      return;
    }

    const payload = {
      ...shelterInsightForm,
      id: shelterInsightForm.id || uid(),
    };

    setShelterInsights((prev) => {
      const exists = prev.some((entry) => entry.id === payload.id);
      return exists
        ? prev.map((entry) => (entry.id === payload.id ? payload : entry))
        : [payload, ...prev];
    });

    setShelterInsightForm(blankShelterInsightForm());
  }

  async function downloadShelterCard() {
    if (!cardPreviewRef.current) return;
    const canvas = await html2canvas(cardPreviewRef.current, {
      backgroundColor: null,
      scale: 2,
    });
    const link = document.createElement("a");
    link.download = `${(shelterForm.name || "dog-card").replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function copyShelterProfile() {
    navigator.clipboard.writeText(shelterProfilePreview);
  }

  function exportWildlifeCSV() {
    const rows = wildlifeEntries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      time: entry.time,
      time_category: entry.timeCategory,
      location_type: entry.locationType,
      camera_id: entry.cameraId,
      camera_spot: entry.cameraSpot,
      species_observed: (entry.speciesObserved || []).join(" | "),
      total_number_of_animals: entry.totalAnimals,
      behavior: entry.behavior,
      weather: entry.weather,
      temperature_range: entry.temperatureRange,
      has_photo: entry.photo ? "Yes" : "No",
      notes: entry.notes,
    }));
    downloadCSV("wildlife-data.csv", rows);
  }

  function exportDogCSV() {
    const rows = dogEntries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      time: entry.time,
      setting: entry.setting,
      condition: entry.condition,
      comfort: entry.comfort,
      engagement: entry.engagement,
      stress: entry.stress,
      used_enrichment: entry.usedEnrichment,
      responded_to_cue: entry.respondedToCue,
      notes: entry.notes,
    }));
    downloadCSV("dog-data.csv", rows);
  }

  function exportShelterCSV() {
    const rows = shelterEntries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      age: entry.age,
      energy_level: entry.energyLevel,
      voice: entry.voice,
      likes: entry.likes,
      best_home_fit: (entry.bestHomeFit || []).join(" | "),
      memorable_trait: entry.memorableTrait,
      bandana_done: entry.bandanaDone,
      photo_done: entry.photoDone,
      story_done: entry.storyDone,
      profile_update_date: entry.profileUpdateDate,
      adoption_date: entry.adoptionDate,
      card_style: entry.cardStyle,
      has_photo: entry.photo ? "Yes" : "No",
      notes: entry.notes,
      generated_profile: entry.generatedProfile,
    }));
    downloadCSV("shelter-data.csv", rows);
  }

  function exportInsightsCSV() {
    const wildlifeRows = wildlifeInsights.map((entry) => ({
      section: "Wildlife",
      id: entry.id,
      entry_date: entry.entryDate,
      observation_start_date: entry.observationStartDate,
      observation_end_date: entry.observationEndDate,
      most_common_animal: entry.mostCommonAnimal,
      most_active_time: entry.mostActiveTime,
      town_vs_lake_differences: entry.townVsLakeDifferences,
      behavior_pattern: entry.behaviorPattern,
      summary_sentence: entry.summarySentence,
    }));

    const dogRows = dogInsights.map((entry) => ({
      section: "Dog",
      id: entry.id,
      entry_date: entry.entryDate,
      observation_start_date: entry.observationStartDate,
      observation_end_date: entry.observationEndDate,
      most_relaxed_condition: entry.mostRelaxedCondition,
      stress_pattern: entry.stressPattern,
      enrichment_effect: entry.enrichmentEffect,
      engagement_pattern: entry.engagementPattern,
      summary_sentence: entry.summarySentence,
    }));

    const shelterRows = shelterInsights.map((entry) => ({
      section: "Shelter",
      id: entry.id,
      entry_date: entry.entryDate,
      observation_start_date: entry.observationStartDate,
      observation_end_date: entry.observationEndDate,
      quickest_adoptions: entry.quickestAdoptions,
      profile_wording_pattern: entry.profileWordingPattern,
      visual_pattern: entry.visualPattern,
      best_home_fit_pattern: entry.bestHomeFitPattern,
      summary_sentence: entry.summarySentence,
    }));

    downloadCSV("insights-data.csv", [...wildlifeRows, ...dogRows, ...shelterRows]);
  }

  /* ---------- render ---------- */

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.headerCard}>
          <div style={styles.eyebrow}>Animal Behavior & Environment Tracker</div>
          <h1 style={styles.h1}>Animal Behavior & Environment Tracker</h1>
          <p style={styles.subtext}>
            Collect → Save → Review → Reflect → Export
          </p>
        </div>

        <div style={styles.navRow}>
          {["home", "wildlife", "dog", "shelter", "insights"].map((tab) => (
            <SectionButton
              key={tab}
              active={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              {toTitleStyle(tab)}
            </SectionButton>
          ))}
        </div>

        {activeTab === "home" && (
          <div style={styles.sectionWrap}>
            <div style={styles.summaryGrid}>
              <SummaryCard title="Wildlife Entries" value={homeSummary.wildlifeCount} />
              <SummaryCard title="Dog Entries" value={homeSummary.dogCount} />
              <SummaryCard title="Shelter Entries" value={homeSummary.shelterCount} />
              <SummaryCard title="Top Species" value={homeSummary.topSpecies} />
              <SummaryCard title="Town Sightings" value={homeSummary.townSightings} />
              <SummaryCard title="Lake Sightings" value={homeSummary.lakeSightings} />
            </div>

            <div style={styles.homeButtonGrid}>
              <PrimaryButton onClick={() => setActiveTab("wildlife")}>
                Wildlife
              </PrimaryButton>
              <PrimaryButton onClick={() => setActiveTab("dog")}>Dog</PrimaryButton>
              <PrimaryButton onClick={() => setActiveTab("shelter")}>
                Shelter
              </PrimaryButton>
              <PrimaryButton onClick={() => setActiveTab("insights")}>
                Insights
              </PrimaryButton>
            </div>
          </div>
        )}

        {activeTab === "wildlife" && (
          <div style={styles.sectionGrid}>
            <div style={styles.card}>
              <h2 style={styles.h2}>Wildlife</h2>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Date</FieldLabel>
                  <TextInput
                    type="date"
                    value={wildlifeForm.date}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Time</FieldLabel>
                  <TextInput
                    type="time"
                    value={wildlifeForm.time}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({ ...prev, time: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Time Category</FieldLabel>
                  <SelectInput
                    value={wildlifeForm.timeCategory}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({
                        ...prev,
                        timeCategory: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {timeCategories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Location Type</FieldLabel>
                  <SelectInput
                    value={wildlifeForm.locationType}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({
                        ...prev,
                        locationType: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {locationTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Camera ID</FieldLabel>
                  <SelectInput
                    value={wildlifeForm.cameraId}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({ ...prev, cameraId: e.target.value }))
                    }
                  >
                    <option value="">Select</option>
                    {cameraIds.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Camera Spot</FieldLabel>
                  <SelectInput
                    value={wildlifeForm.cameraSpot}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({
                        ...prev,
                        cameraSpot: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {cameraSpots.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <FieldLabel>Species Observed</FieldLabel>
              <div style={styles.pillWrap}>
                {wildlifeSpecies.map((species) => (
                  <PillButton
                    key={species}
                    active={wildlifeForm.speciesObserved.includes(species)}
                    onClick={() => toggleWildlifeSpecies(species)}
                  >
                    {species}
                  </PillButton>
                ))}
              </div>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Total Number of Animals</FieldLabel>
                  <SelectInput
                    value={wildlifeForm.totalAnimals}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({
                        ...prev,
                        totalAnimals: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {animalCounts.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Behavior</FieldLabel>
                  <SelectInput
                    value={wildlifeForm.behavior}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({ ...prev, behavior: e.target.value }))
                    }
                  >
                    <option value="">Select</option>
                    {wildlifeBehaviors.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Weather</FieldLabel>
                  <SelectInput
                    value={wildlifeForm.weather}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({ ...prev, weather: e.target.value }))
                    }
                  >
                    <option value="">Select</option>
                    {weatherOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Temperature Range</FieldLabel>
                  <SelectInput
                    value={wildlifeForm.temperatureRange}
                    onChange={(e) =>
                      setWildlifeForm((prev) => ({
                        ...prev,
                        temperatureRange: e.target.value,
                      }))
                    }
                  >
                    <option value="">Optional</option>
                    {temperatureRanges.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <div>
                <FieldLabel>Photo Upload</FieldLabel>
                <TextInput type="file" accept="image/*" onChange={handleWildlifePhotoChange} />
              </div>

              <div>
                <FieldLabel>Notes</FieldLabel>
                <TextArea
                  placeholder="Optional"
                  value={wildlifeForm.notes}
                  onChange={(e) =>
                    setWildlifeForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              <div style={styles.buttonRow}>
                <PrimaryButton onClick={saveWildlifeEntry}>
                  {wildlifeForm.id ? "Update Wildlife Entry" : "Save Wildlife Entry"}
                </PrimaryButton>
                <SecondaryButton onClick={exportWildlifeCSV}>Export CSV</SecondaryButton>
                <SecondaryButton onClick={() => setWildlifeForm(blankWildlifeForm())}>
                  Clear
                </SecondaryButton>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.h2}>Saved Wildlife Entries</h2>
              {wildlifeEntries.length === 0 ? (
                <p style={styles.muted}>No wildlife entries yet.</p>
              ) : (
                wildlifeEntries.map((entry) => (
                  <div key={entry.id} style={styles.savedItem}>
                    <div style={styles.savedTitle}>
                      {(entry.speciesObserved || []).join(", ")} • {entry.date}
                    </div>
                    <div style={styles.savedMeta}>
                      {entry.time} • {entry.timeCategory} • {entry.locationType} •{" "}
                      {entry.cameraId} • {entry.cameraSpot}
                    </div>
                    <div style={styles.savedMeta}>
                      {entry.totalAnimals} animal(s) • {entry.behavior} • {entry.weather}
                    </div>
                    {entry.notes ? <div style={styles.savedNotes}>{entry.notes}</div> : null}
                    <div style={styles.buttonRowSmall}>
                      <SecondaryButton onClick={() => setWildlifeForm(entry)}>
                        Edit
                      </SecondaryButton>
                      <SecondaryButton
                        onClick={() =>
                          setWildlifeEntries((prev) =>
                            prev.filter((item) => item.id !== entry.id)
                          )
                        }
                      >
                        Delete
                      </SecondaryButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "dog" && (
          <div style={styles.sectionGrid}>
            <div style={styles.card}>
              <h2 style={styles.h2}>Dog</h2>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Date</FieldLabel>
                  <TextInput
                    type="date"
                    value={dogForm.date}
                    onChange={(e) =>
                      setDogForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Time</FieldLabel>
                  <TextInput
                    type="time"
                    value={dogForm.time}
                    onChange={(e) =>
                      setDogForm((prev) => ({ ...prev, time: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Setting</FieldLabel>
                <SelectInput
                  value={dogForm.setting}
                  onChange={(e) =>
                    setDogForm((prev) => ({ ...prev, setting: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  {dogSettings.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </SelectInput>
              </div>

              <div>
                <FieldLabel>Condition (what is happening during this observation?)</FieldLabel>
                <TextArea
                  placeholder="ex: sitting near human, playing, using puzzle toy, resting after activity"
                  value={dogForm.condition}
                  onChange={(e) =>
                    setDogForm((prev) => ({ ...prev, condition: e.target.value }))
                  }
                />
                <div style={styles.pillWrap}>
                  {dogConditionSuggestions.map((item) => (
                    <PillButton
                      key={item}
                      active={dogForm.condition.includes(item)}
                      onClick={() =>
                        setDogForm((prev) => ({
                          ...prev,
                          condition: appendSuggestion(prev.condition, item),
                        }))
                      }
                    >
                      {item}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div style={styles.formGridThree}>
                <div>
                  <FieldLabel>Comfort</FieldLabel>
                  <SelectInput
                    value={dogForm.comfort}
                    onChange={(e) =>
                      setDogForm((prev) => ({ ...prev, comfort: e.target.value }))
                    }
                  >
                    <option value="">Select</option>
                    {dogComfort.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Engagement</FieldLabel>
                  <SelectInput
                    value={dogForm.engagement}
                    onChange={(e) =>
                      setDogForm((prev) => ({
                        ...prev,
                        engagement: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {dogEngagement.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Stress</FieldLabel>
                  <SelectInput
                    value={dogForm.stress}
                    onChange={(e) =>
                      setDogForm((prev) => ({ ...prev, stress: e.target.value }))
                    }
                  >
                    <option value="">Select</option>
                    {dogStress.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Used Enrichment</FieldLabel>
                  <SelectInput
                    value={dogForm.usedEnrichment}
                    onChange={(e) =>
                      setDogForm((prev) => ({
                        ...prev,
                        usedEnrichment: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {yesNo.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Responded to Cue</FieldLabel>
                  <SelectInput
                    value={dogForm.respondedToCue}
                    onChange={(e) =>
                      setDogForm((prev) => ({
                        ...prev,
                        respondedToCue: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {cueOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <div>
                <FieldLabel>Notes</FieldLabel>
                <TextArea
                  placeholder="Optional"
                  value={dogForm.notes}
                  onChange={(e) =>
                    setDogForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              <div style={styles.buttonRow}>
                <PrimaryButton onClick={saveDogEntry}>
                  {dogForm.id ? "Update Dog Entry" : "Save Dog Entry"}
                </PrimaryButton>
                <SecondaryButton onClick={exportDogCSV}>Export CSV</SecondaryButton>
                <SecondaryButton onClick={() => setDogForm(blankDogForm())}>
                  Clear
                </SecondaryButton>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.h2}>Saved Dog Entries</h2>
              {dogEntries.length === 0 ? (
                <p style={styles.muted}>No dog entries yet.</p>
              ) : (
                dogEntries.map((entry) => (
                  <div key={entry.id} style={styles.savedItem}>
                    <div style={styles.savedTitle}>
                      {entry.date} • {entry.time}
                    </div>
                    <div style={styles.savedMeta}>
                      {entry.setting} • comfort {entry.comfort} • engagement{" "}
                      {entry.engagement} • stress {entry.stress}
                    </div>
                    <div style={styles.savedMeta}>{entry.condition}</div>
                    {entry.notes ? <div style={styles.savedNotes}>{entry.notes}</div> : null}
                    <div style={styles.buttonRowSmall}>
                      <SecondaryButton onClick={() => setDogForm(entry)}>
                        Edit
                      </SecondaryButton>
                      <SecondaryButton
                        onClick={() =>
                          setDogEntries((prev) =>
                            prev.filter((item) => item.id !== entry.id)
                          )
                        }
                      >
                        Delete
                      </SecondaryButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "shelter" && (
          <div style={styles.sectionGrid}>
            <div style={styles.card}>
              <h2 style={styles.h2}>Shelter</h2>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <TextInput
                    value={shelterForm.name}
                    onChange={(e) =>
                      setShelterForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Age</FieldLabel>
                  <TextInput
                    value={shelterForm.age}
                    onChange={(e) =>
                      setShelterForm((prev) => ({ ...prev, age: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Energy Level</FieldLabel>
                  <SelectInput
                    value={shelterForm.energyLevel}
                    onChange={(e) =>
                      setShelterForm((prev) => ({
                        ...prev,
                        energyLevel: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {shelterEnergy.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Voice</FieldLabel>
                  <SelectInput
                    value={shelterForm.voice}
                    onChange={(e) =>
                      setShelterForm((prev) => ({ ...prev, voice: e.target.value }))
                    }
                  >
                    {shelterVoice.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <div>
                <FieldLabel>Likes</FieldLabel>
                <TextArea
                  value={shelterForm.likes}
                  onChange={(e) =>
                    setShelterForm((prev) => ({ ...prev, likes: e.target.value }))
                  }
                />
                <div style={styles.pillWrap}>
                  {shelterLikesSuggestions.map((item) => (
                    <PillButton
                      key={item}
                      active={shelterForm.likes.includes(item)}
                      onClick={() =>
                        setShelterForm((prev) => ({
                          ...prev,
                          likes: appendSuggestion(prev.likes, item),
                        }))
                      }
                    >
                      {item}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Best Home Fit</FieldLabel>
                <div style={styles.pillWrap}>
                  {shelterBestHomeFitOptions.map((option) => (
                    <PillButton
                      key={option}
                      active={shelterForm.bestHomeFit.includes(option)}
                      onClick={() => toggleBestHomeFit(option)}
                    >
                      {option}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Memorable Trait</FieldLabel>
                <TextArea
                  value={shelterForm.memorableTrait}
                  onChange={(e) =>
                    setShelterForm((prev) => ({
                      ...prev,
                      memorableTrait: e.target.value,
                    }))
                  }
                />
                <div style={styles.pillWrap}>
                  {shelterTraitSuggestions.map((item) => (
                    <PillButton
                      key={item}
                      active={shelterForm.memorableTrait.includes(item)}
                      onClick={() =>
                        setShelterForm((prev) => ({
                          ...prev,
                          memorableTrait: appendSuggestion(prev.memorableTrait, item),
                        }))
                      }
                    >
                      {item}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div style={styles.formGridThree}>
                <div>
                  <FieldLabel>Bandana Done</FieldLabel>
                  <SelectInput
                    value={shelterForm.bandanaDone}
                    onChange={(e) =>
                      setShelterForm((prev) => ({
                        ...prev,
                        bandanaDone: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {yesNo.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Photo Done</FieldLabel>
                  <SelectInput
                    value={shelterForm.photoDone}
                    onChange={(e) =>
                      setShelterForm((prev) => ({
                        ...prev,
                        photoDone: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {yesNo.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Story Done</FieldLabel>
                  <SelectInput
                    value={shelterForm.storyDone}
                    onChange={(e) =>
                      setShelterForm((prev) => ({
                        ...prev,
                        storyDone: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {yesNo.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Profile Update Date</FieldLabel>
                  <TextInput
                    type="date"
                    value={shelterForm.profileUpdateDate}
                    onChange={(e) =>
                      setShelterForm((prev) => ({
                        ...prev,
                        profileUpdateDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Adoption Date</FieldLabel>
                  <TextInput
                    type="date"
                    value={shelterForm.adoptionDate}
                    onChange={(e) =>
                      setShelterForm((prev) => ({
                        ...prev,
                        adoptionDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div style={styles.formGridTwo}>
                <div>
                  <FieldLabel>Card Style</FieldLabel>
                  <SelectInput
                    value={shelterForm.cardStyle}
                    onChange={(e) =>
                      setShelterForm((prev) => ({
                        ...prev,
                        cardStyle: e.target.value,
                      }))
                    }
                  >
                    {shelterCardStyles.map((style) => (
                      <option key={style.value} value={style.value}>
                        {style.label}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Favorite Photo Upload</FieldLabel>
                  <TextInput
                    type="file"
                    accept="image/*"
                    onChange={handleShelterPhotoChange}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Notes</FieldLabel>
                <TextArea
                  placeholder="Optional"
                  value={shelterForm.notes}
                  onChange={(e) =>
                    setShelterForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              <div style={styles.generatedBox}>
                <div style={styles.generatedHeader}>Generated Profile Blurb</div>
                <div style={styles.generatedText}>{shelterProfilePreview}</div>
                <div style={styles.buttonRowSmall}>
                  <SecondaryButton onClick={copyShelterProfile}>Copy Profile</SecondaryButton>
                </div>
              </div>

              <div style={styles.buttonRow}>
                <PrimaryButton onClick={saveShelterEntry}>
                  {shelterForm.id ? "Update Shelter Entry" : "Save Shelter Entry"}
                </PrimaryButton>
                <SecondaryButton onClick={exportShelterCSV}>Export CSV</SecondaryButton>
                <SecondaryButton onClick={() => setShelterForm(blankShelterForm())}>
                  Clear
                </SecondaryButton>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.h2}>Trading Card Preview</h2>

              <div
                ref={cardPreviewRef}
                style={{
                  ...styles.cardPreviewOuter,
                  background: cardStyleColors(shelterForm.cardStyle).outer,
                }}
              >
                <div
                  style={{
                    ...styles.cardPreviewInner,
                    borderColor: cardStyleColors(shelterForm.cardStyle).border,
                  }}
                >
                  <div style={styles.cardHeaderRow}>
                    <div>
                      <div style={styles.cardEyebrow}>Adopt Me</div>
                      <div style={styles.cardName}>{shelterForm.name || "Dog Name"}</div>
                      <div style={styles.cardSub}>Shelter Spotlight Card</div>
                    </div>
                    <div
                      style={{
                        ...styles.energyBadge,
                        background: cardStyleColors(shelterForm.cardStyle).accentBg,
                        color: cardStyleColors(shelterForm.cardStyle).accentText,
                      }}
                    >
                      {shelterForm.energyLevel || "Medium"} energy
                    </div>
                  </div>

                  <div style={styles.cardPhotoBox}>
                    {shelterForm.photo ? (
                      <img
                        src={shelterForm.photo}
                        alt={shelterForm.name || "Dog"}
                        style={styles.cardPhoto}
                      />
                    ) : (
                      <div style={styles.cardPhotoPlaceholder}>Photo goes here</div>
                    )}
                  </div>

                  <div style={styles.cardStatsRow}>
                    <div
                      style={{
                        ...styles.statChip,
                        background: cardStyleColors(shelterForm.cardStyle).accentBg,
                        color: cardStyleColors(shelterForm.cardStyle).accentText,
                      }}
                    >
                      Age: {shelterForm.age || "—"}
                    </div>
                    <div
                      style={{
                        ...styles.statChip,
                        background: cardStyleColors(shelterForm.cardStyle).accentBg,
                        color: cardStyleColors(shelterForm.cardStyle).accentText,
                      }}
                    >
                      Bandana: {shelterForm.bandanaDone || "—"}
                    </div>
                    <div
                      style={{
                        ...styles.statChip,
                        background: cardStyleColors(shelterForm.cardStyle).accentBg,
                        color: cardStyleColors(shelterForm.cardStyle).accentText,
                      }}
                    >
                      Story: {shelterForm.storyDone || "—"}
                    </div>
                  </div>

                  <div style={styles.cardHighlights}>
                    <div style={styles.cardHighlightLabel}>Highlights</div>
                    <div style={styles.cardBlurb}>{shelterProfilePreview}</div>
                  </div>
                </div>
              </div>

              <div style={styles.buttonRowSmall}>
                <SecondaryButton onClick={downloadShelterCard}>
                  Download Card PNG
                </SecondaryButton>
              </div>

              <h2 style={{ ...styles.h2, marginTop: 24 }}>Saved Shelter Entries</h2>
              {shelterEntries.length === 0 ? (
                <p style={styles.muted}>No shelter entries yet.</p>
              ) : (
                shelterEntries.map((entry) => (
                  <div key={entry.id} style={styles.savedItem}>
                    <div style={styles.savedTitle}>
                      {entry.name} • {entry.age}
                    </div>
                    <div style={styles.savedMeta}>
                      {entry.energyLevel} energy • updated {entry.profileUpdateDate}
                    </div>
                    <div style={styles.savedNotes}>{entry.generatedProfile}</div>
                    <div style={styles.buttonRowSmall}>
                      <SecondaryButton onClick={() => setShelterForm(entry)}>
                        Edit
                      </SecondaryButton>
                      <SecondaryButton
                        onClick={() =>
                          setShelterEntries((prev) =>
                            prev.filter((item) => item.id !== entry.id)
                          )
                        }
                      >
                        Delete
                      </SecondaryButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "insights" && (
          <div style={styles.insightsWrap}>
            <div style={styles.sectionGrid}>
              <div style={styles.card}>
                <h2 style={styles.h2}>Wildlife Insights</h2>

                <div style={styles.formGridTwo}>
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <TextInput
                      type="date"
                      value={wildlifeInsightForm.entryDate}
                      onChange={(e) =>
                        setWildlifeInsightForm((prev) => ({
                          ...prev,
                          entryDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div />
                </div>

                <div style={styles.formGridTwo}>
                  <div>
                    <FieldLabel>Observation Start Date</FieldLabel>
                    <TextInput
                      type="date"
                      value={wildlifeInsightForm.observationStartDate}
                      onChange={(e) =>
                        setWildlifeInsightForm((prev) => ({
                          ...prev,
                          observationStartDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Observation End Date</FieldLabel>
                    <TextInput
                      type="date"
                      value={wildlifeInsightForm.observationEndDate}
                      onChange={(e) =>
                        setWildlifeInsightForm((prev) => ({
                          ...prev,
                          observationEndDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <FieldLabel>What animal did you see most?</FieldLabel>
                <TextInput
                  value={wildlifeInsightForm.mostCommonAnimal}
                  onChange={(e) =>
                    setWildlifeInsightForm((prev) => ({
                      ...prev,
                      mostCommonAnimal: e.target.value,
                    }))
                  }
                />

                <FieldLabel>When were animals most active?</FieldLabel>
                <TextInput
                  value={wildlifeInsightForm.mostActiveTime}
                  onChange={(e) =>
                    setWildlifeInsightForm((prev) => ({
                      ...prev,
                      mostActiveTime: e.target.value,
                    }))
                  }
                />

                <FieldLabel>What differences did you notice between town and lake?</FieldLabel>
                <TextArea
                  value={wildlifeInsightForm.townVsLakeDifferences}
                  onChange={(e) =>
                    setWildlifeInsightForm((prev) => ({
                      ...prev,
                      townVsLakeDifferences: e.target.value,
                    }))
                  }
                />

                <FieldLabel>What behavior pattern stood out?</FieldLabel>
                <TextArea
                  value={wildlifeInsightForm.behaviorPattern}
                  onChange={(e) =>
                    setWildlifeInsightForm((prev) => ({
                      ...prev,
                      behaviorPattern: e.target.value,
                    }))
                  }
                />

                <FieldLabel>Summary sentence</FieldLabel>
                <TextArea
                  value={wildlifeInsightForm.summarySentence}
                  onChange={(e) =>
                    setWildlifeInsightForm((prev) => ({
                      ...prev,
                      summarySentence: e.target.value,
                    }))
                  }
                />

                <div style={styles.buttonRow}>
                  <PrimaryButton onClick={saveWildlifeInsight}>
                    {wildlifeInsightForm.id ? "Update Wildlife Insight" : "Save Wildlife Insight"}
                  </PrimaryButton>
                  <SecondaryButton onClick={exportInsightsCSV}>
                    Export Insights CSV
                  </SecondaryButton>
                  <SecondaryButton onClick={() => setWildlifeInsightForm(blankWildlifeInsightForm())}>
                    Clear
                  </SecondaryButton>
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Saved Wildlife Insights</h2>
                {wildlifeInsights.length === 0 ? (
                  <p style={styles.muted}>No wildlife insights yet.</p>
                ) : (
                  wildlifeInsights.map((entry) => (
                    <div key={entry.id} style={styles.savedItem}>
                      <div style={styles.savedTitle}>
                        {entry.entryDate} • {entry.observationStartDate} to {entry.observationEndDate}
                      </div>
                      <div style={styles.savedNotes}>{entry.summarySentence}</div>
                      <div style={styles.buttonRowSmall}>
                        <SecondaryButton onClick={() => setWildlifeInsightForm(entry)}>
                          Edit
                        </SecondaryButton>
                        <SecondaryButton
                          onClick={() =>
                            setWildlifeInsights((prev) =>
                              prev.filter((item) => item.id !== entry.id)
                            )
                          }
                        >
                          Delete
                        </SecondaryButton>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.sectionGrid}>
              <div style={styles.card}>
                <h2 style={styles.h2}>Dog Insights</h2>

                <div style={styles.formGridTwo}>
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <TextInput
                      type="date"
                      value={dogInsightForm.entryDate}
                      onChange={(e) =>
                        setDogInsightForm((prev) => ({
                          ...prev,
                          entryDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div />
                </div>

                <div style={styles.formGridTwo}>
                  <div>
                    <FieldLabel>Observation Start Date</FieldLabel>
                    <TextInput
                      type="date"
                      value={dogInsightForm.observationStartDate}
                      onChange={(e) =>
                        setDogInsightForm((prev) => ({
                          ...prev,
                          observationStartDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Observation End Date</FieldLabel>
                    <TextInput
                      type="date"
                      value={dogInsightForm.observationEndDate}
                      onChange={(e) =>
                        setDogInsightForm((prev) => ({
                          ...prev,
                          observationEndDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <FieldLabel>When was your dog most relaxed?</FieldLabel>
                <TextInput
                  value={dogInsightForm.mostRelaxedCondition}
                  onChange={(e) =>
                    setDogInsightForm((prev) => ({
                      ...prev,
                      mostRelaxedCondition: e.target.value,
                    }))
                  }
                />

                <FieldLabel>What stress pattern did you notice?</FieldLabel>
                <TextArea
                  value={dogInsightForm.stressPattern}
                  onChange={(e) =>
                    setDogInsightForm((prev) => ({
                      ...prev,
                      stressPattern: e.target.value,
                    }))
                  }
                />

                <FieldLabel>What did enrichment seem to do?</FieldLabel>
                <TextArea
                  value={dogInsightForm.enrichmentEffect}
                  onChange={(e) =>
                    setDogInsightForm((prev) => ({
                      ...prev,
                      enrichmentEffect: e.target.value,
                    }))
                  }
                />

                <FieldLabel>What engagement pattern did you notice?</FieldLabel>
                <TextArea
                  value={dogInsightForm.engagementPattern}
                  onChange={(e) =>
                    setDogInsightForm((prev) => ({
                      ...prev,
                      engagementPattern: e.target.value,
                    }))
                  }
                />

                <FieldLabel>Summary sentence</FieldLabel>
                <TextArea
                  value={dogInsightForm.summarySentence}
                  onChange={(e) =>
                    setDogInsightForm((prev) => ({
                      ...prev,
                      summarySentence: e.target.value,
                    }))
                  }
                />

                <div style={styles.buttonRow}>
                  <PrimaryButton onClick={saveDogInsight}>
                    {dogInsightForm.id ? "Update Dog Insight" : "Save Dog Insight"}
                  </PrimaryButton>
                  <SecondaryButton onClick={exportInsightsCSV}>
                    Export Insights CSV
                  </SecondaryButton>
                  <SecondaryButton onClick={() => setDogInsightForm(blankDogInsightForm())}>
                    Clear
                  </SecondaryButton>
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Saved Dog Insights</h2>
                {dogInsights.length === 0 ? (
                  <p style={styles.muted}>No dog insights yet.</p>
                ) : (
                  dogInsights.map((entry) => (
                    <div key={entry.id} style={styles.savedItem}>
                      <div style={styles.savedTitle}>
                        {entry.entryDate} • {entry.observationStartDate} to {entry.observationEndDate}
                      </div>
                      <div style={styles.savedNotes}>{entry.summarySentence}</div>
                      <div style={styles.buttonRowSmall}>
                        <SecondaryButton onClick={() => setDogInsightForm(entry)}>
                          Edit
                        </SecondaryButton>
                        <SecondaryButton
                          onClick={() =>
                            setDogInsights((prev) =>
                              prev.filter((item) => item.id !== entry.id)
                            )
                          }
                        >
                          Delete
                        </SecondaryButton>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.sectionGrid}>
              <div style={styles.card}>
                <h2 style={styles.h2}>Shelter Insights</h2>

                <div style={styles.formGridTwo}>
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <TextInput
                      type="date"
                      value={shelterInsightForm.entryDate}
                      onChange={(e) =>
                        setShelterInsightForm((prev) => ({
                          ...prev,
                          entryDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div />
                </div>

                <div style={styles.formGridTwo}>
                  <div>
                    <FieldLabel>Observation Start Date</FieldLabel>
                    <TextInput
                      type="date"
                      value={shelterInsightForm.observationStartDate}
                      onChange={(e) =>
                        setShelterInsightForm((prev) => ({
                          ...prev,
                          observationStartDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Observation End Date</FieldLabel>
                    <TextInput
                      type="date"
                      value={shelterInsightForm.observationEndDate}
                      onChange={(e) =>
                        setShelterInsightForm((prev) => ({
                          ...prev,
                          observationEndDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <FieldLabel>Which dogs were adopted fastest?</FieldLabel>
                <TextInput
                  value={shelterInsightForm.quickestAdoptions}
                  onChange={(e) =>
                    setShelterInsightForm((prev) => ({
                      ...prev,
                      quickestAdoptions: e.target.value,
                    }))
                  }
                />

                <FieldLabel>What pattern did you notice in profile wording?</FieldLabel>
                <TextArea
                  value={shelterInsightForm.profileWordingPattern}
                  onChange={(e) =>
                    setShelterInsightForm((prev) => ({
                      ...prev,
                      profileWordingPattern: e.target.value,
                    }))
                  }
                />

                <FieldLabel>What pattern did you notice in visuals/photos?</FieldLabel>
                <TextArea
                  value={shelterInsightForm.visualPattern}
                  onChange={(e) =>
                    setShelterInsightForm((prev) => ({
                      ...prev,
                      visualPattern: e.target.value,
                    }))
                  }
                />

                <FieldLabel>What pattern did you notice in best-home-fit categories?</FieldLabel>
                <TextArea
                  value={shelterInsightForm.bestHomeFitPattern}
                  onChange={(e) =>
                    setShelterInsightForm((prev) => ({
                      ...prev,
                      bestHomeFitPattern: e.target.value,
                    }))
                  }
                />

                <FieldLabel>Summary sentence</FieldLabel>
                <TextArea
                  value={shelterInsightForm.summarySentence}
                  onChange={(e) =>
                    setShelterInsightForm((prev) => ({
                      ...prev,
                      summarySentence: e.target.value,
                    }))
                  }
                />

                <div style={styles.buttonRow}>
                  <PrimaryButton onClick={saveShelterInsight}>
                    {shelterInsightForm.id
                      ? "Update Shelter Insight"
                      : "Save Shelter Insight"}
                  </PrimaryButton>
                  <SecondaryButton onClick={exportInsightsCSV}>
                    Export Insights CSV
                  </SecondaryButton>
                  <SecondaryButton onClick={() => setShelterInsightForm(blankShelterInsightForm())}>
                    Clear
                  </SecondaryButton>
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Saved Shelter Insights</h2>
                {shelterInsights.length === 0 ? (
                  <p style={styles.muted}>No shelter insights yet.</p>
                ) : (
                  shelterInsights.map((entry) => (
                    <div key={entry.id} style={styles.savedItem}>
                      <div style={styles.savedTitle}>
                        {entry.entryDate} • {entry.observationStartDate} to {entry.observationEndDate}
                      </div>
                      <div style={styles.savedNotes}>{entry.summarySentence}</div>
                      <div style={styles.buttonRowSmall}>
                        <SecondaryButton onClick={() => setShelterInsightForm(entry)}>
                          Edit
                        </SecondaryButton>
                        <SecondaryButton
                          onClick={() =>
                            setShelterInsights((prev) =>
                              prev.filter((item) => item.id !== entry.id)
                            )
                          }
                        >
                          Delete
                        </SecondaryButton>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- styles ---------- */

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #eff6ff 0%, #f0f9ff 40%, #eef2ff 100%)",
    padding: "20px",
    boxSizing: "border-box",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: "#0f172a",
  },
  shell: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  headerCard: {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid #dbeafe",
    borderRadius: "24px",
    padding: "20px",
    boxShadow: "0 6px 18px rgba(30, 64, 175, 0.06)",
    marginBottom: "16px",
  },
  eyebrow: {
    fontSize: "11px",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: "8px",
  },
  h1: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.15,
    color: "#172554",
  },
  subtext: {
    marginTop: "8px",
    marginBottom: 0,
    color: "#475569",
  },
  navRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "16px",
  },
  navButton: {
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    color: "#1e3a8a",
    borderRadius: "16px",
    padding: "10px 16px",
    fontSize: "14px",
    cursor: "pointer",
  },
  navButtonActive: {
    background: "#1d4ed8",
    color: "#ffffff",
    borderColor: "#1d4ed8",
  },
  sectionWrap: {
    display: "grid",
    gap: "16px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
  },
  summaryCard: {
    background: "#ffffff",
    border: "1px solid #dbeafe",
    borderRadius: "20px",
    padding: "16px",
    boxShadow: "0 4px 14px rgba(30, 64, 175, 0.05)",
  },
  summaryTitle: {
    fontSize: "12px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "8px",
  },
  summaryValue: {
    fontSize: "24px",
    color: "#1e3a8a",
    fontWeight: 700,
  },
  homeButtonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: "16px",
    alignItems: "start",
  },
  insightsWrap: {
    display: "grid",
    gap: "16px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dbeafe",
    borderRadius: "24px",
    padding: "18px",
    boxShadow: "0 6px 18px rgba(30, 64, 175, 0.06)",
  },
  h2: {
    marginTop: 0,
    color: "#172554",
    fontSize: "22px",
    marginBottom: "14px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    color: "#1e293b",
    marginBottom: "6px",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: "44px",
    borderRadius: "14px",
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    padding: "0 12px",
    fontSize: "14px",
    color: "#0f172a",
    outline: "none",
    marginBottom: "12px",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "88px",
    borderRadius: "14px",
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#0f172a",
    outline: "none",
    resize: "vertical",
    marginBottom: "12px",
  },
  formGridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  formGridThree: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
  },
  primaryButton: {
    border: "none",
    background: "#1d4ed8",
    color: "#ffffff",
    borderRadius: "16px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    color: "#1e3a8a",
    borderRadius: "16px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  pillWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "12px",
  },
  pill: {
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    color: "#1e3a8a",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "13px",
    cursor: "pointer",
  },
  pillActive: {
    background: "#1d4ed8",
    borderColor: "#1d4ed8",
    color: "#ffffff",
  },
  generatedBox: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    borderRadius: "18px",
    padding: "14px",
    marginBottom: "12px",
  },
  generatedHeader: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#1e3a8a",
    marginBottom: "8px",
  },
  generatedText: {
    fontSize: "14px",
    color: "#334155",
    lineHeight: 1.6,
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "4px",
  },
  buttonRowSmall: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "10px",
  },
  savedItem: {
    border: "1px solid #dbeafe",
    background: "#f8fbff",
    borderRadius: "18px",
    padding: "12px",
    marginBottom: "12px",
  },
  savedTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#172554",
    marginBottom: "4px",
  },
  savedMeta: {
    fontSize: "13px",
    color: "#475569",
    marginBottom: "4px",
  },
  savedNotes: {
    fontSize: "14px",
    color: "#334155",
    lineHeight: 1.5,
    marginTop: "6px",
  },
  muted: {
    color: "#64748b",
    margin: 0,
  },
  cardPreviewOuter: {
    borderRadius: "28px",
    padding: "10px",
    maxWidth: "360px",
    margin: "0 auto",
    boxShadow: "0 10px 24px rgba(30, 64, 175, 0.18)",
  },
  cardPreviewInner: {
    borderRadius: "24px",
    background: "rgba(255,255,255,0.96)",
    border: "2px solid #bfdbfe",
    padding: "12px",
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  cardEyebrow: {
    fontSize: "10px",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: "6px",
  },
  cardName: {
    fontSize: "26px",
    lineHeight: 1.05,
    fontWeight: 800,
    color: "#0f172a",
  },
  cardSub: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "4px",
  },
  energyBadge: {
    borderRadius: "999px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  cardPhotoBox: {
    background: "#e2e8f0",
    borderRadius: "18px",
    overflow: "hidden",
    minHeight: "240px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardPhoto: {
    width: "100%",
    height: "240px",
    objectFit: "cover",
    display: "block",
  },
  cardPhotoPlaceholder: {
    color: "#64748b",
    fontSize: "14px",
  },
  cardStatsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
    marginTop: "12px",
  },
  statChip: {
    borderRadius: "14px",
    padding: "8px",
    fontSize: "12px",
    fontWeight: 700,
    textAlign: "center",
  },
  cardHighlights: {
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "12px",
    marginTop: "12px",
  },
  cardHighlightLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "#64748b",
    marginBottom: "8px",
  },
  cardBlurb: {
    fontSize: "14px",
    color: "#334155",
    lineHeight: 1.55,
  },
};

/* simple responsive tweak */
const styleTag = document.createElement("style");
styleTag.innerHTML = `
@media (max-width: 960px) {
  .responsive-grid-fallback {}
}
@media (max-width: 900px) {
  div[style*="grid-template-columns: 1.15fr 0.85fr"] {
    grid-template-columns: 1fr !important;
  }
}
@media (max-width: 700px) {
  div[style*="grid-template-columns: 1fr 1fr 1fr"] {
    grid-template-columns: 1fr !important;
  }
  div[style*="grid-template-columns: 1fr 1fr"] {
    grid-template-columns: 1fr !important;
  }
  input, select, textarea, button {
    font-size: 16px !important;
  }
}
`;
if (!document.head.querySelector('style[data-abe="1"]')) {
  styleTag.setAttribute("data-abe", "1");
  document.head.appendChild(styleTag);
}