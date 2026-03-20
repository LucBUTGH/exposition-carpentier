# Plan : Restructuration multi-pages inspiree maxwechsler.fr

## Architecture cible

### Pages (5 fichiers HTML separees) :
1. **index.html** — Page d'accueil (hero plein ecran + accroche minimale)
2. **exposition.html** — Texte de presentation de l'expo + infos pratiques (lieu, horaires, contact) + invitation PDF
3. **galerie.html** — Grille d'oeuvres (dynamique via API) + lightbox
4. **artiste.html** — Biographie, citations, timeline des expositions + poeme Cheng
5. **contact.html** — Formulaire newsletter

### Navigation (commune a toutes les pages) :
- **Header fixe** : logo "Philippe Carpentier" a gauche, burger icon a droite
- **Burger menu** : overlay plein ecran au clic, liens vers chaque page, animation ouverture/fermeture
- Style maxwechsler.fr : fond blanc, texte noir, police Helvetica, bordures fines 1px

### Design (refonte CSS complete) :
- Police : **Helvetica, sans-serif** (remplacer Century Gothic)
- Fond : **blanc pur #ffffff** partout
- Texte : **noir #000000** principal, gris #666 secondaire
- Accents : garder le **gold #b8922e** pour les details subtils
- Pas d'ombres, pas de bruit, pas de grayscale sur images
- Transitions fluides 300ms
- Bordures fines 1px noir ou gris clair
- Espacement genereux (5vw de padding)

## Fichiers a modifier/creer

### Creer :
- `exposition.html`
- `galerie.html`
- `artiste.html`
- `contact.html`

### Modifier :
- `index.html` — Garder uniquement hero + nav/footer, simplifier
- `css/style.css` — Refonte complete du style (blanc, Helvetica, burger menu)
- `js/main.js` — Adapter pour multi-pages (init conditionnel par page) + burger menu logic
- `vercel.json` — Ajouter rewrites pour clean URLs (/exposition, /galerie, /artiste, /contact)

### Ne pas toucher :
- `admin.html`, `css/admin.css`, `js/admin.js` — Le panel admin reste tel quel
- `api/` — L'API reste identique

## Etapes d'implementation

1. Recrire `css/style.css` avec le nouveau design (Helvetica, blanc, burger menu, styles par page)
2. Recrire `index.html` (hero minimaliste + nav burger + footer)
3. Creer `exposition.html` (contenu expo + infos pratiques + invitation)
4. Creer `galerie.html` (grille d'oeuvres + lightbox)
5. Creer `artiste.html` (bio + citations + timeline + poeme)
6. Creer `contact.html` (formulaire newsletter)
7. Recrire `js/main.js` (burger menu + init conditionnel par page)
8. Mettre a jour `vercel.json` (rewrites pour clean URLs)
