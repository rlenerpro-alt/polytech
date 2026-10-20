# PHOT 3A — appli de révision (PWA)

Planning ADE automatique, devoirs, plan de révision avec suivi des heures, notes pondérées par la maquette, pages de cours et arbre de compétences.
Site statique + une fonction Vercel (`api/ade.js`) qui relaie ADE + Supabase pour les comptes et la synchronisation.

## 1. Supabase (une seule fois)
1. **SQL Editor → New query** : coller le contenu de `supabase/schema.sql`, puis **Run**.
2. **Authentication → URL Configuration** :
   - *Site URL* : l'adresse Vercel (ex. `https://polytech-app.vercel.app`)
   - *Redirect URLs* : ajouter la même adresse.
3. (Facultatif) **Authentication → Providers → Email** : désactiver *Confirm email* pour que la création de compte soit immédiate.

L'URL du projet et la clé publique (`sb_publishable_…`) sont déjà dans `index.html`. La clé `service_role` ne doit jamais apparaître dans ce dépôt.

## 2. GitHub
Créer un dépôt (ex. `polytech-app`) et y envoyer tout le contenu de ce dossier
(glisser-déposer dans l'interface web de GitHub, ou `git push`).

## 3. Vercel
1. **Add New → Project** → importer le dépôt → *Framework Preset* : **Other** → **Deploy**.
2. **Settings → Environment Variables** :
   - rien d'obligatoire : les liens ADE spécialité (1305) et tronc commun (1380) sont déjà configurés
   - `ADE_SPE_URL` / `ADE_TC_URL` : seulement pour les remplacer par d'autres liens (puis **Redeploy**)

## 4. Récupérer tes données de l'ancienne version
Dans l'ancienne appli : **Notes → Réglages → Sauvegarde → Exporter (JSON)**, copier le texte.
Dans la nouvelle, une fois connecté : même endroit, coller, **Importer le JSON collé**.

## 5. Installer sur téléphone
- iPhone : ouvrir le site dans **Safari** → bouton Partager → **Sur l'écran d'accueil**.
- Android : Chrome → menu → **Installer l'application**.

## Mettre à jour une page de cours
Remplacer le fichier dans `pages/`, incrémenter `VERSION` dans `sw.js`, pousser sur GitHub : Vercel redéploie seul.
