# Slávia Catering ERP

Interný rezervačný a ERP systém pre Slávia Catering.

## Aktuálny stav

- klikateľný frontend prototyp
- kalendár akcií
- karta akcie s ID
- Banketky A/B/C/D
- externé lokality
- zákazkový catering / len výroba
- program akcie
- menu a chody
- interná kalkulácia podľa počtu hostí × cena/osoba
- návrh skladu a inventúry
- pripravený Firebase/Firestore základ

## Súbory

- `index.html` – aktuálny frontend
- `app-firestore.js` – základ pre napojenie Firestore
- `firebase-config.example.js` – šablóna Firebase web configu
- `firestore.rules` – návrh bezpečnostných pravidiel
- `firestore.indexes.json` – indexy
- `firebase.json` – Firebase Hosting/Firestore config
- `seed-data.json` – ukážkové dáta a priestory

## Firebase setup

1. Vytvor nový Firebase projekt, napr. `slavia-catering-erp`.
2. Zapni Firestore Database.
3. Zapni Authentication > Email/Password.
4. V Project settings vytvor Web App.
5. Skopíruj `firebase-config.example.js` ako `firebase-config.js`.
6. Doplň hodnoty z Firebase `firebaseConfig`.
7. `firebase-config.js` sa zámerne necommitne do GitHubu.

## Firestore model

Hlavné kolekcie:

- `users`
- `clients`
- `venues`
- `events`
- `inventory`
- `stock`

Podkolekcie udalosti:

- `events/{eventId}/timeline`
- `events/{eventId}/menu`
- `events/{eventId}/private/finance`

Financie sú zámerne oddelené od hlavného event dokumentu kvôli oprávneniam.

## GitHub prvý commit

```bash
git init
git add .
git commit -m "Initial Slavia ERP prototype"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Neskôr

Po pripojení Firebase sa mock dáta v `index.html` nahradia reálnym čítaním/zápisom z Firestore.


## Menu builder
V2 pridáva skladbu menu v kroku Nová akcia. Produkčne sa katalóg jedál presunie do Firestore kolekcie `foods` a prílohy môžu byť samostatné položky alebo tagované jedlá. Podporované budú aliasy, kategórie, alergény, kuchyňa/krajina, ingrediencie a kombinované prílohy s percentuálnym pomerom.
