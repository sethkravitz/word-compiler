<script lang="ts">
import type { Bible, ChapterArc, CharacterDossier, Location, ScenePlan } from "../../types/index.js";
import {
  createEmptyBible,
  createEmptyChapterArc,
  createEmptyCharacterDossier,
  createEmptyScenePlan,
  generateId,
} from "../../types/index.js";
import { createCommands } from "../store/commands.js";
import AtlasPane from "./AtlasPane.svelte";

let {
  hasBible = false,
  hasBibleRich = false,
  hasScenes = false,
  hasArc = false,
  initialTab = "bible",
}: {
  hasBible?: boolean;
  hasBibleRich?: boolean;
  hasScenes?: boolean;
  hasArc?: boolean;
  initialTab?: string;
} = $props();

function buildRichBible(projectId: string): Bible {
  const bible = createEmptyBible(projectId);

  const alice: CharacterDossier = {
    ...createEmptyCharacterDossier("Alice Chen"),
    id: "char-alice",
    role: "protagonist",
    physicalDescription: "Late thirties, angular face softened by laugh lines. Always wears her mother's jade ring.",
    backstory:
      "Investigative journalist who left the Tribune after the Hendricks scandal. Now freelancing, she tells herself it's freedom, but it's closer to exile.",
    selfNarrative: "I am someone who finds the truth. That's what I do. That's all I do.",
    contradictions: [
      "Claims to value honesty but lies habitually about small things",
      "Says she doesn't need people but panics in isolation",
    ],
    voice: {
      sentenceLengthRange: [5, 25],
      vocabularyNotes: "Precise, clinical diction that slips into profanity under stress. Never uses euphemisms.",
      verbalTics: ["Look,", "The thing is—", "Right?"],
      metaphoricRegister: "Mechanical and architectural — things break, collapse, get rebuilt",
      prohibitedLanguage: ["heart of gold", "sharp as a tack", "like a bolt from the blue"],
      dialogueSamples: [
        "I'm not asking you to trust me. I'm asking you to look at the numbers.",
        "Don't do that. Don't make this about feelings when it's about money.",
      ],
    },
    behavior: {
      stressResponse: "Gets very still, voice drops to a whisper, begins organizing physical objects around her",
      socialPosture: "Dominant in conversation, asks rapid questions, rarely volunteers personal information",
      noticesFirst: "Inconsistencies — what people say vs. what they do",
      lyingStyle:
        "Deflection and misdirection rather than fabrication. Changes the subject rather than stating falsehoods.",
      emotionPhysicality: "Tension collects in her jaw and hands. Smiles rarely but genuinely.",
    },
  };

  const bob: CharacterDossier = {
    ...createEmptyCharacterDossier("Bob Mercer"),
    id: "char-bob",
    role: "antagonist",
    physicalDescription: "Heavyset, perpetually sunburned. Wears expensive watches with cheap suits.",
    backstory:
      "City councilman turned developer. Built his career on handshakes and favors. Grew up poor and swore he'd never go back.",
    selfNarrative: "Everything I've done has been for this city. They'll understand someday.",
    voice: {
      sentenceLengthRange: [8, 35],
      vocabularyNotes: "Folksy veneer over sharp political instincts. Uses sports metaphors constantly.",
      verbalTics: ["Now listen—", "I'll be honest with you—"],
      metaphoricRegister: "Sports and weather — everything is a game, a storm, a season",
      prohibitedLanguage: ["dastardly", "nefarious"],
      dialogueSamples: ["That's not how this game works, sweetheart. And you know it."],
    },
    behavior: null,
  };

  const loc1: Location = {
    id: "loc-newsroom",
    name: "The Tribune Newsroom",
    description:
      "Open-plan office with fluorescent lighting and the persistent hum of aging HVAC. Half the desks are empty now.",
    sensoryPalette: {
      sounds: ["keyboard clatter", "scanner hum", "distant phone ringing"],
      smells: ["stale coffee", "printer toner"],
      textures: ["sticky laminate desks", "threadbare carpet"],
      lightQuality: "Harsh fluorescent with one tube flickering in the northeast corner",
      atmosphere: "Exhausted determination — the skeleton crew of a dying institution",
      prohibitedDefaults: ["bustling newsroom", "stop the presses"],
    },
  };

  const loc2: Location = {
    id: "loc-pier",
    name: "Harbor Pier 7",
    description: "Abandoned commercial pier. Concrete crumbling, iron railings rusted through in places.",
    sensoryPalette: {
      sounds: ["water slapping pilings", "distant foghorn"],
      smells: ["brine", "diesel", "rotting wood"],
      textures: ["salt-crusted concrete", "wet rope"],
      lightQuality: "Overcast diffusion — no shadows, everything flat and gray",
      atmosphere: "Desolate but not sinister — just forgotten",
      prohibitedDefaults: [],
    },
  };

  bible.characters = [alice, bob];
  bible.locations = [loc1, loc2];
  bible.styleGuide = {
    killList: [
      { pattern: "suddenly", type: "exact" },
      { pattern: "she realized", type: "structural" },
      { pattern: "it was as if", type: "structural" },
    ],
    metaphoricRegister: {
      approvedDomains: ["architecture", "weather", "machinery"],
      prohibitedDomains: ["food/cooking", "dance", "music"],
    },
    vocabularyPreferences: [
      { preferred: "said", insteadOf: "exclaimed" },
      { preferred: "walked", insteadOf: "sauntered" },
    ],
    sentenceArchitecture: {
      targetVariance: "high — mix fragments with compound-complex",
      fragmentPolicy: "allowed for emphasis, max 2 consecutive",
      notes: null,
    },
    paragraphPolicy: {
      maxSentences: 5,
      singleSentenceFrequency: "every 3-4 paragraphs for emphasis",
      notes: null,
    },
    negativeExemplars: [
      {
        text: "Her heart hammered like a drum as she suddenly realized the truth.",
        annotation: "Cliché cascade — dead metaphor + suddenly + filter verb",
      },
    ],
    positiveExemplars: [
      {
        text: "The numbers didn't add up. She checked them twice, then closed the laptop.",
        annotation: "Clean action beats, no interior filter",
      },
    ],
    structuralBans: ["dream sequences", "mirror self-description"],
  };
  bible.narrativeRules = {
    pov: {
      default: "close-third",
      distance: "close",
      interiority: "filtered",
      reliability: "reliable",
      notes: "Camera stays with Alice. No head-hopping. Bob's interiority only via Alice's inference.",
    },
    subtextPolicy:
      "Characters never state themes directly. Subtext through action, dialogue misdirection, and environmental detail.",
    expositionPolicy: "Drip-feed only. No info-dumps. Backstory through present-tense implications.",
    sceneEndingPolicy: "End on an image or action, never on a thought. Cut before resolution.",
    setups: [
      {
        id: generateId(),
        description: "The jade ring belonged to Alice's mother",
        plantedInScene: null,
        payoffInScene: null,
        status: "planned",
      },
      {
        id: generateId(),
        description: "Bob's alibi for Tuesday night",
        plantedInScene: "scene-1",
        payoffInScene: null,
        status: "planted",
      },
    ],
  };

  return bible;
}

function buildScenePlan(projectId: string): ScenePlan {
  const plan = createEmptyScenePlan(projectId);
  return {
    ...plan,
    title: "The Letter Arrives",
    povCharacterId: "char-alice",
    povDistance: "close",
    narrativeGoal: "Establish Alice's daily routine, then shatter it with the anonymous letter",
    emotionalBeat: "Comfort → unease → dread",
    readerEffect: "Reader should feel the wrongness before Alice does — dramatic irony via environmental cues",
    failureModeToAvoid: "Opening too slowly with backstory exposition instead of present action",
    pacing: "Measured opening (establishing shots), accelerating from letter arrival",
    density: "moderate",
    sensoryNotes:
      "Emphasize the newsroom's decay. The letter should feel physically wrong — wrong paper stock, wrong ink.",
    subtext: {
      surfaceConversation: "Alice asks the intern about mail delivery schedules",
      actualConversation: "Alice is probing whether anyone saw who left the letter",
      enforcementRule: "Alice never directly states her suspicion aloud",
    },
    readerStateEntering: {
      knows: ["Alice is a journalist"],
      suspects: [],
      wrongAbout: ["Alice chose freelancing willingly"],
      activeTensions: [],
    },
    readerStateExiting: {
      knows: ["Alice is a journalist", "An anonymous letter mentions Bob's name"],
      suspects: ["The letter writer knows Alice personally"],
      wrongAbout: ["Alice chose freelancing willingly"],
      activeTensions: ["What does the letter contain?", "Who sent it?"],
    },
    sceneSpecificProhibitions: ["no flashbacks", "no phone conversations"],
    anchorLines: [
      {
        text: "The envelope had no return address, but it smelled like her mother's kitchen.",
        placement: "scene opening",
        verbatim: true,
      },
    ],
    estimatedWordCount: [1200, 1800],
    chunkCount: 3,
    chunkDescriptions: [
      "Alice arrives at the newsroom, establishes routine and environment",
      "The letter is discovered — Alice reads it, initial reaction",
      "Alice begins to investigate — asks questions, gets stonewalled",
    ],
    locationId: "loc-newsroom",
  };
}

class MockStore {
  bible = $state<Bible | null>(null);
  activeScenePlan = $state<ScenePlan | null>(null);
  chapterArc = $state<ChapterArc | null>(null);
  scenes = $state<any[]>([]);
  project = $state<{ id: string; title: string } | null>({ id: "proj-1", title: "Mock Project" });
  bootstrapModalOpen = $state(false);
  bibleAuthoringOpen = $state(false);

  constructor(withBible: boolean, withRichBible: boolean, withScenes: boolean, withArc: boolean) {
    if (withRichBible) {
      this.bible = buildRichBible("proj-1");
    } else if (withBible) {
      this.bible = createEmptyBible("proj-1");
    }

    if (withScenes) {
      const plan = buildScenePlan("proj-1");
      this.activeScenePlan = plan;
      this.scenes = [{ plan, status: "planned", sceneOrder: 0 }];
    }

    if (withArc) {
      const arc = createEmptyChapterArc("proj-1", 1);
      this.chapterArc = {
        ...arc,
        workingTitle: "The Letter",
        narrativeFunction: "Inciting incident — shatters Alice's false sense of security",
        dominantRegister: "Restrained → explosive",
        pacingTarget: "Slow build in scenes 1-2, rapid acceleration in scene 3",
        endingPosture: "Cliffhanger — Bob's accusation hangs unanswered",
        readerStateEntering: {
          knows: ["Alice is a journalist investigating corruption"],
          suspects: ["Bob may be hiding something"],
          wrongAbout: ["Marcus is a stranger to Alice"],
          activeTensions: ["Will Alice find evidence?"],
        },
        readerStateExiting: {
          knows: ["Alice is a journalist", "Bob lied about his alibi"],
          suspects: ["Marcus is connected to the cover-up"],
          wrongAbout: [],
          activeTensions: ["What will Alice do with the letter?", "Is Bob dangerous?"],
        },
      };
    }
  }
  setBible(bible: Bible | null) {
    this.bible = bible;
  }
  setScenePlan(plan: ScenePlan | null) {
    this.activeScenePlan = plan;
  }
  setBibleAuthoringOpen(v: boolean) {
    this.bibleAuthoringOpen = v;
  }
  setError(_msg: string) {}
  setBootstrapOpen(v: boolean) {
    this.bootstrapModalOpen = v;
  }
  loadFile() {
    return Promise.resolve(null);
  }
  saveFile() {}
}

const store = new MockStore(hasBible, hasBibleRich, hasScenes, hasArc);
const commands = createCommands(store as any);
</script>

<div class="story-container">
  <AtlasPane
    store={store as any}
    {commands}
    onBootstrap={() => {}}
    onAuthor={() => {}}
    {initialTab}
  />
</div>

<style>
  .story-container {
    height: 600px;
    width: 360px;
    border: 1px solid var(--border, #333);
  }
</style>
