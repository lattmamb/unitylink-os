# GitHub Fork Catalog for UnityLink Integration

Snapshot reviewed 2026-10-20 from GitHub repository metadata for the 100 repositories exposed on the connected profile. This list records GitHub's fork flag and parent repository, not whether the fork contains meaningful local changes. Fork stars are not upstream stars. The integration decision is based on the proposed UnityLink stack; source-level diff and license checks remain required before code is reused.

## A. Orchestration, agent runtimes and agent frameworks

| Profile repository | Parent | UnityLink role | Decision |
|---|---|---|---|
| paperclip | paperclipai/paperclip | Orchestration, assignments, approvals, budgets | Integrate by API; pin and compare upstream drift |
| agent-zero | agent0ai/agent-zero | General-purpose runtime | Benchmark as optional runtime |
| suna | kortix-ai/suna | General-purpose agent platform | Alternative runtime; don't make second task authority |
| AutoGPT | Significant-Gravitas/AutoGPT | Agent platform | Reference/benchmark only |
| OpenManus | FoundationAgents/OpenManus | Agent framework | Reference/benchmark only |
| crewAI | crewAIInc/crewAI | Multi-agent framework | Adapter candidate; benchmark first |
| PraisonAI | MervinPraison/PraisonAI | Multi-agent framework | Adapter candidate; benchmark first |
| SuperAGI | TransformerOptimus/SuperAGI | Agent framework | Legacy/reference until verified |
| smolagents | huggingface/smolagents | Lightweight agent execution | Runtime/tool adapter candidate |
| superagentx | superagentxai/superagentx | Agent orchestration | Benchmark only |
| agent-builder-api | nagaraj-real/agent-builder-api | Agent construction/API | Inspect before use |
| code-act | xingyaoww/code-act | Code-action agent pattern | Reference; sandbox execution |
| autoMate | yuruotong1/autoMate | Automation/agent framework | Benchmark only |
| agent-gpt | Not a GitHub fork | Autonomous agent project | Not a fork; candidate only after code audit |

## B. Model access, inference, memory and routing

| Profile repository | Parent | UnityLink role | Decision |
|---|---|---|---|
| litellm | BerriAI/litellm | Provider routing/gateway | Optional; require provider allowlists and spend caps |
| langchain | langchain-ai/langchain | Model/application framework | Use packages only where needed; do not merge repo |
| pydantic-ai | pydantic/pydantic-ai | Typed agent/application framework | Alternative to evaluate, not mandatory |
| open-webui | open-webui/open-webui | Model interface | Optional operator-facing model UI |
| anything-llm | Mintplex-Labs/anything-llm | LLM app / retrieval UI | Alternative UI; avoid overlapping knowledge stores |
| text-generation-webui | oobabooga/textgen | Local model interface | Optional local inference interface |
| self-llm | datawhalechina/self-llm | Local model learning/operations | Reference unless specific use is proven |
| raycast_ollama | MassimilianoPasquini97/raycast_ollama | Local model launcher integration | Optional developer convenience |
| supermemory | supermemoryai/supermemory | Memory/retrieval | Only as a derived context layer, never canonical business records |
| deepseek-engineer | Doriandarko/deepseek-engineer | Coding agent pattern | Reference/benchmark |
| AI-Infinity | meetpateltech/AI-Infinity | AI application reference | Research candidate, inspect exact scope |
| llamacoder | Nutlope/llamacoder | Code-generation interface | Developer tool/reference |

## C. Browser, computer use and MCP/tool connectivity

| Profile repository | Parent | UnityLink role | Decision |
|---|---|---|---|
| browser-ai | lightpanda-io/browser | Headless browser/runtime | Browser adapter; test compatibility and sandbox |
| nanobrowser | nanobrowser/nanobrowser | Browser automation | Alternative browser adapter |
| Web-Agent | Jeomon/Web-Use | Playwright/browser agent | Alternative browser adapter |
| mcp-server-macos-use | mediar-ai/mcp-server-macos-use | Mac computer-use tool | Local operator tool; require explicit action policy |
| servers | modelcontextprotocol/servers | MCP server examples | Source/reference for selected connectors |
| mcp-containers | metorial/metorial | MCP/container infrastructure | Inspect exact parent and current scope; connector sandbox candidate |
| aci | aipotheosis-labs/aci | Tool/API connection layer | Connector candidate |
| blender-mcp | ahujasid/mcp-for-blender | 3D/Blender control | Optional design pipeline connector |
| desktop | e2b-dev/desktop | Desktop/computer environment | Isolated execution candidate; clarify exact use before deployment |
| script-commands | raycast/script-commands | Reusable automation scripts | Adapt vetted scripts into capabilities; don't blindly install |
| facebook-page-info-scraper | wael-sudo2/facebook-page-info-scraper | Social data extraction | Out of core; review terms/privacy before any use |

## D. Product UI, web frameworks and design systems

| Profile repository | Parent | UnityLink role | Decision |
|---|---|---|---|
| three.js | mrdoob/three.js | 3D visualizations | Dependency/reference, not a copied monorepo |
| expo | expo/expo | React Native/mobile tooling | Mobile app platform option |
| dioxus | DioxusLabs/dioxus | Rust UI framework | Alternative UI stack; not needed alongside React without a reason |
| onlook | onlook-dev/onlook | Visual editing/design tooling | Optional design workflow |
| bolt.diy | stackblitz-labs/bolt.diy | App-generation interface | Prototype/reference; don't make it a production source of truth |
| extensions | raycast/extensions | Extension catalog | Reference for selected integrations |
| Tempo | maoyama/Changes | UI/change workflow candidate | Inspect current tree and actual modifications before use |
| galaxy | uiverse-io/galaxy | UI/visual project | Design reference pending source audit |
| awesome-mac | jaywcjlove/awesome-mac | Developer tools catalog | Research only |
| awesome-nocode-lowcode | valentin-vogel/awesome-nocode-lowcode | No-code catalog | Research only |
| awesome-llm-apps | Shubhamsaboo/awesome-llm-apps | Example catalog | Research only; evaluate individual examples |
| awesome-minimax-integrations | MiniMax-AI/awesome-minimax-integrations | Integration catalog | Research only |
| AITreasureBox | superiorlu/AITreasureBox | AI tools catalog | Research only |
| generative-ai-for-beginners | microsoft/generative-ai-for-beginners | Learning materials | Reference only |
| build-your-own-x | codecrafters-io/build-your-own-x | Learning examples | Reference only |
| Self-Hosting-Guide | mikeroyal/Self-Hosting-Guide | Deployment research | Reference only |

## E. Data, CRM, ERP, billing and infrastructure

| Profile repository | Parent | UnityLink role | Decision |
|---|---|---|---|
| supabase | supabase/supabase | Database/auth platform | Evaluate only if a deliberate persistence migration is approved |
| nextjs-subscription-payments | vercel/nextjs-subscription-payments | Subscription billing starter | Extract patterns/adapters; don't run duplicate billing authority |
| twenty | twentyhq/twenty | CRM | Integrate only if CRM gap warrants a separate bounded service |
| odoo | odoo/odoo | ERP | Optional integration; do not fork-merge into core |
| metasfresh | metasfresh/metasfresh | ERP | Alternative ERP; don't deploy alongside Odoo by default |
| webpack-cli | webpack/webpack-cli | Build tooling | Upstream developer dependency; don't merge into product runtime |
| Calf | MohamedRejeb/Calf | UI/component framework | Inspect framework fit; optional dependency |

## F. Vehicle, energy and domain-specific modules

| Profile repository | Parent | UnityLink role | Decision |
|---|---|---|---|
| Battery-Emulator | dalathegreat/Battery-Emulator | Battery/energy integration research | Isolate; hardware compatibility and safety review required |
| ai-hedge-fund | virattt/ai-hedge-fund | Financial research example | Research only; not investment or accounting authority |
| facebook-page-info-scraper | wael-sudo2/facebook-page-info-scraper | Social data extraction | Out of core unless a specific approved workflow needs it |

## G. Prompt, research and reference libraries

| Profile repository | Parent | UnityLink role | Decision |
|---|---|---|---|
| GenAI_Agents | NirDiamant/GenAI_Agents | Agent examples | Extract individual patterns into tested capabilities |
| system-prompts-and-models-of-ai-tools | x1xhlol/system-prompts-and-models-of-ai-tools | Prompt/reference collection | Research only; verify license and provenance |
| leaked-system-prompts | jujumilk3/leaked-system-prompts | Prompt collection | Do not use as an instruction source; provenance and authorization concerns |
| awesome-llm-apps | Shubhamsaboo/awesome-llm-apps | Example catalog | Research only |
| awesome-nocode-lowcode | valentin-vogel/awesome-nocode-lowcode | Tool catalog | Research only |
| Self-Hosting-Guide | mikeroyal/Self-Hosting-Guide | Deployment reference | Research only |

## H. Critical provenance observations

- GitHub's fork flag is authoritative for the repository's current fork status. Some Unity mobility projects are not GitHub forks even when they are derived from shared starter templates.
- The profile's fork count does not indicate useful local divergence. Each fork still needs compare-to-parent analysis to identify changes worth preserving.
- The Paperclip fork's recorded push was 2026-10-13. Its upstream is active, so upstream drift must be measured before treating the fork as the canonical orchestrator.
- Multiple repositories can point to the same Lovable project ID. That indicates a possible shared origin, not proof that their current source trees are identical.
- Several projects are large upstream mirrors. The intended integration pattern is usually a pinned dependency, service, adapter or reference—not a wholesale code merge.
- License metadata can be absent or ambiguous. Do not copy or redistribute code until the actual license and upstream notices are reviewed.
- This catalog covers the GitHub metadata surfaced for the connected profile at review time. Private repos were not all inspected at source level; no credentials or private code should be copied into public artifacts.
