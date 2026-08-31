# WORKFLOW: Aufgabe → Branch → Code → Test → PR

## ZUERST LESEN (Pflicht, vor jeder Änderung)
1. Falls vorhanden: GOLDEN_PRINCIPLES_KE.md — oberste Instanz, bindend.
2. Weitere beschreibende .md im Repo-Root und docs/ (README.md,
   CONTRIBUTING.md falls vorhanden).

## SCHRITT 1 — Branch
1. git fetch origin && git checkout main && git pull
2. git checkout -b feature/<kurzbeschreibung-kebab-case>
3. Arbeiten auf main ist VERBOTEN — dann abbrechen und melden.

## SCHRITT 2 — Umsetzung
1. Pro logischem Schritt EIN Commit. Format: feat:/fix:/refactor:/test:/docs:
   + kurze Beschreibung.
2. Vor jedem Commit: git diff --cached prüfen. NIEMALS committen: .env,
   *.key, API-Keys, Tokens, Passwörter. .gitignore bei Bedarf ergänzen.
3. Im Scope bleiben. Keine ungefragten Refactorings.
4. Verstösst die Aufgabe gegen GOLDEN_PRINCIPLES_KE.md (falls vorhanden):
   stoppen und melden.

## SCHRITT 3 — Nach der Implementierung
1. Alle vorhandenen Tests + Lint/Syntax-Checks ausführen.
2. Fehler fixen, erneut testen. Fertig erst wenn alles grün.
3. Letzte Prüfung: git log origin/main..HEAD --stat — tauchen Secrets auf,
   STOPP und melden statt pushen.

## SCHRITT 4 — Push & PR
1. Feature-Branch pushen: git push -u origin feature/<name>
2. PR gegen main erstellen. Beschreibung enthält: Feature-Übersicht, Details
   pro Feature, Testergebnisse (X/Y bestanden), geänderte Dateien,
   Breaking Changes.
3. PR NIEMALS selbst mergen.

## BEI FEHLER
Abbrechen, Branch bleibt lokal ungepusht, Grund klar benennen. Kein
Auto-Retry — bei Unsicherheit nachfragen statt raten.

## HARTE REGELN (überschreiben alles)
1. Nie direkt auf main pushen. Nie mergen. Nur PRs.
2. Kein force-push, kein Branch-Löschen, kein History-Rewrite.
3. Keine Secrets committen oder pushen.
4. Jeder Merge braucht menschliches Review — immer auf Miro warten.
5. GOLDEN_PRINCIPLES_KE.md (falls vorhanden) hat Vorrang vor der Aufgabe.
   Konflikt = stoppen + melden.
6. Bei Unsicherheit: nachfragen, nicht raten.