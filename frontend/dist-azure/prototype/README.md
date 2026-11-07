# KAYA presentation prototype

A Portuguese, Angola-first customer demo for presentation. It is independent of FlutterFlow and does not replace the existing application.

**Presentation URL:** https://genovesi-jm.github.io/health-/prototype/

## Five-minute walkthrough

1. **Início:** introduce KAYA as a single place to find and organise care in Angola.
2. **Encontrar farmácia:** filter pharmacies, search a zone and explore the real Luanda map. All provider names and hours are fictitious. “Consultar directório real do Azure” makes a read-only request to the KAYA public directory; it currently may have no verified listings.
3. **Consultas:** select a specialty, future date and time; simulate a booking and show it in the agenda. It exists only in memory.
4. **Teleconsulta:** enter the demonstration room and explore the microphone/camera controls. These controls never activate device hardware or connect a clinician.
5. **Documentos:** process the built-in sample and review illustrative extracted fields. This is a simulation, not an OCR request, upload or certificate verification.
6. **Ambulância:** select a pickup zone and simulate the request summary. It sends no dispatch request and gives no arrival promise.
7. **Meu perfil:** explain the planned privacy model and reset the demo for the next audience.

## Run locally

From this directory:

```sh
python3 -m http.server 4178 --bind 127.0.0.1
```

Open http://127.0.0.1:4178. No build or account is needed. Hash navigation works on GitHub Pages without server rewrites.

## What is real vs simulated

- Real: browser navigation, search/filtering, in-memory booking/cancellation, map interaction, optional device GPS, public Azure directory GET.
- Simulated: providers, availability, consultation records, video calls, document extraction and ambulance requests.
- GPS is requested only through the explicit device-GPS button. Coordinates are shown in the dialog, not saved or sent to Azure/map services.
- No passwords, health records, payments, file uploads, camera or microphone capture.
- No localStorage or persistent patient data. Refresh resets the examples.
- Maps use OpenStreetMap embeds; map tiles and Google Fonts need Internet access. Font fallbacks and the core demo work without those services.
- Azure integration requires the GitHub Pages origin in backend CORS. Network failures show a recoverable message and do not block the presentation.
- The existing KAYA backend remains hosted on Azure. This prototype does not provision another database or clinical service.

## Validation

Run `node scripts/test-prototype.cjs` from the repository frontend directory after `npm ci`. The checks cover navigation, accessible button labels, filtering, booking/cancellation, video simulation, document examples, ambulance disclaimer/map changes, reset and absence of persistent health data/outbound writes. The existing frontend production build also validates that these files are included in the Pages artifact.

## Publication

Files live under `frontend/public/prototype/`, copied to `frontend/dist/prototype/` by the existing Vite build. The existing GitHub Pages workflow publishes them along with the app. Main application routes are unchanged.
