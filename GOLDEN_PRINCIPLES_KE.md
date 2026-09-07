# GOLDEN PRINCIPLES — OpenClaw-Test

Diese Regeln sind bindend für alle automatisierten Änderungen in diesem Repo.

## Code-Regeln
1. Alle neuen JavaScript-Funktionen erhalten einen JSDoc-Kommentar (mindestens
   eine Beschreibungszeile und @param/@returns wo zutreffend).
2. Kein console.log in committetem Code. Debug-Ausgaben vor dem Commit entfernen.
3. Alle für Benutzer sichtbaren UI-Texte sind auf Deutsch.
4. Neue Konstanten in SCREAMING_SNAKE_CASE, Funktionen und Variablen in camelCase.

## Commit-Regeln
5. Commit-Messages verwenden einen Scope: feat(quiz):, fix(shop):, test(race): usw.

## Schutzbereiche
6. Die Datei soundcheck.html darf von automatisierten Agenten NICHT verändert
   werden (manuelle Freigabe durch Miro erforderlich).
7. Bestehende localStorage-Keys (vroooom_favorites, vroooom_reviews) dürfen
   nicht umbenannt werden.

## Arbeitsweise
8. Jedes neue Feature erhält mindestens einen Testfall in tests/.
