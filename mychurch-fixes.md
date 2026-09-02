# Mychurch — Correctifs techniques : clavier mobile, temps réel, viewport iOS/Android

Ce document est destiné à être donné tel quel à ton IA/dev pour implémentation. Stack concernée : Next.js (App Router), React + TS, Tailwind, Prisma, Supabase (DB + Realtime), OneSignal, shadcn/ui, Zustand.

---

## 1. Le clavier coupe l'écriture sur mobile

### Cause racine
`100vh` est figé au chargement de la page. Sur iOS Safari et Android Chrome, l'apparition du clavier virtuel ne redéclenche PAS de recalcul de `100vh` — le layout garde sa hauteur d'origine et le clavier vient simplement **recouvrir** le bas de l'écran, y compris le textarea.

### Solution : piloter la hauteur via `window.visualViewport`

Crée un hook dédié qui écoute les événements `resize` et `scroll` de `visualViewport` et pousse la hauteur réelle disponible dans une variable CSS.

```ts
// hooks/useVisualViewportHeight.ts
'use client';
import { useEffect } from 'react';

export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const setHeight = () => {
      // hauteur réellement visible (hors clavier)
      document.documentElement.style.setProperty('--app-height', `${vv.height}px`);
      // décalage vertical si le viewport visuel est poussé (iOS)
      document.documentElement.style.setProperty('--vv-offset-top', `${vv.offsetTop}px`);
    };

    setHeight();
    vv.addEventListener('resize', setHeight);
    vv.addEventListener('scroll', setHeight);

    return () => {
      vv.removeEventListener('resize', setHeight);
      vv.removeEventListener('scroll', setHeight);
    };
  }, []);
}
```

Appelle-le une seule fois, dans le layout racine du client (ex. `app/providers.tsx` ou le composant qui englobe toute la SPA) :

```tsx
'use client';
export function AppShell({ children }: { children: React.ReactNode }) {
  useVisualViewportHeight();
  return <div style={{ height: 'var(--app-height, 100dvh)' }}>{children}</div>;
}
```

### CSS — remplacer tous les `calc(100vh - 8rem)`

```css
/* globals.css */
:root {
  --app-height: 100dvh; /* valeur par défaut avant hydratation JS */
}

.chat-container {
  height: var(--app-height);
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1 1 auto;
  overflow-y: auto;
}

.chat-input-bar {
  flex: 0 0 auto;
}
```

Le principe important : **arrête de calculer une hauteur fixe pour la zone de saisie**. Passe en layout flex où la zone de messages est `flex: 1` (elle se comprime automatiquement) et la barre de saisie est `flex: 0 0 auto` — elle garde sa taille naturelle et remonte avec le clavier parce que le conteneur parent a la bonne hauteur (`--app-height`).

### Bonus : scroll automatique au focus

```ts
const handleFocus = () => {
  // laisse le temps au clavier de s'ouvrir avant de scroller
  setTimeout(() => {
    inputRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, 300);
};
```

---

## 2. Passer du polling à du vrai temps réel

### Cause racine
Les messages sont récupérés par `setInterval` toutes les 10s (requête Prisma/API). Supabase Realtime existe déjà dans le code mais seulement pour les compteurs non-lus, pas pour le flux de messages lui-même.

### Étape A — activer la réplication Realtime sur la table `messages`

Dans Supabase Dashboard → Database → Replication, active la table `messages` (et éventuellement `conversations`) pour le canal `postgres_changes`. Si géré en SQL :

```sql
alter publication supabase_realtime add table messages;
```

Vérifie aussi que la RLS de `messages` autorise le `SELECT` pour les participants de la conversation, sinon les events realtime seront filtrés silencieusement côté serveur.

### Étape B — remplacer le polling par une souscription

```ts
// hooks/useRealtimeMessages.ts
'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useChatStore } from '@/store/chatStore';

export function useRealtimeMessages(conversationId: string) {
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => addMessage(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => updateMessage(payload.new) // ex: statut "lu"
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, addMessage, updateMessage]);
}
```

Supprime tout `setInterval(fetchMessages, 10000)` existant : le fetch initial reste (un seul appel au montage pour charger l'historique), mais le flux continu passe entièrement par le channel.

### Étape C — feedback in-app immédiat (toast + son + vibration)

Le store Zustand centralise déjà `unreadCount`. Ajoute une réaction quand un message arrive pour une conversation qui n'est **pas** celle actuellement ouverte :

```ts
// dans le callback INSERT du channel global (souscrit une fois au niveau app, pas par conversation)
if (payload.new.conversation_id !== activeConversationId) {
  useChatStore.getState().incrementUnread(payload.new.conversation_id);

  toast({
    title: payload.new.sender_name,
    description: payload.new.content,
  });

  if ('vibrate' in navigator) navigator.vibrate(80);

  new Audio('/sounds/message.mp3').play().catch(() => {});
}
```

Utilise le composant `Toast`/`Sonner` de shadcn/ui, déjà dispo dans le design system.

### Étape D — indicateur "en train d'écrire" (optionnel mais cohérent avec le temps réel)

Supabase Realtime propose aussi les **Broadcast** et **Presence**, plus légers que postgres_changes pour ce genre d'état éphémère :

```ts
channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
  setTypingUser(payload.userId);
});

// à l'émission
channel.send({ type: 'broadcast', event: 'typing', payload: { userId } });
```

### Répartition des rôles OneSignal vs Supabase Realtime
- **Supabase Realtime** → mise à jour instantanée de l'UI pendant que l'app est ouverte (peu importe l'onglet actif).
- **OneSignal** → notification système quand l'app est fermée/en arrière-plan.
Les deux sont complémentaires, pas redondants ; garde OneSignal tel quel, il ne gère pas le rafraîchissement de l'UI en direct.

---

## 3. Adaptation réelle aux écrans iOS/Android (hauteur + safe areas)

### Cause racine
`100vh` ne tient pas compte de la barre d'URL Safari (rétractable) ni des zones sécurisées (encoche, home indicator). Le `viewport-fit=cover` est posé dans le `<meta>` mais rien dans le CSS n'exploite `env(safe-area-inset-*)`.

### A. Remplacer `100vh` par `100dvh` + fallback JS
`100dvh` (dynamic viewport height) est supporté sur iOS Safari ≥ 15.4 et Chrome Android récents et se recalcule automatiquement à l'apparition/disparition de la barre d'adresse. Le hook du point 1 (`--app-height` via `visualViewport`) sert aussi de fallback pour les navigateurs plus anciens — garde les deux :

```css
.chat-container {
  height: 100dvh;              /* moderne, natif */
  height: var(--app-height);   /* écrase avec la valeur JS si dispo, plus précis pendant le clavier */
}
```

### B. Appliquer les safe-area-insets à la barre de saisie

```css
.chat-input-bar {
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
  padding-left: calc(1rem + env(safe-area-inset-left));
  padding-right: calc(1rem + env(safe-area-inset-right));
}
```

Avec Tailwind, tu peux déclarer ces valeurs comme utilitaires custom dans `tailwind.config.ts` :

```ts
// tailwind.config.ts
theme: {
  extend: {
    padding: {
      'safe-b': 'env(safe-area-inset-bottom)',
      'safe-t': 'env(safe-area-inset-top)',
    },
  },
}
```

Puis dans le JSX :

```tsx
<div className="chat-input-bar pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
```

Vérifie aussi le header et toute barre de navigation fixe en haut : appliquer `padding-top: env(safe-area-inset-top)` évite que le contenu passe sous l'encoche.

### C. Confirmer le `<meta>` viewport
Il doit rester tel quel, c'est correct :

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

Sans `viewport-fit=cover`, `env(safe-area-inset-*)` renvoie `0px` partout — donc le meta est une pré-condition indispensable, ce que vous avez déjà.

### D. Éviter le double comptage clavier + safe-area
Attention : quand le clavier est ouvert, `env(safe-area-inset-bottom)` doit être ignoré (le home indicator est masqué par le clavier). Comme `--app-height` vient de `visualViewport.height` qui exclut déjà le clavier, le padding safe-area ne doit s'appliquer qu'à la position de repos. La solution la plus robuste : appliquer le safe-area-inset-bottom sur le conteneur racine (`body` ou wrapper externe) plutôt que sur la barre de saisie elle-même, pour que ce soit uniquement actif quand le clavier est fermé.

```css
body {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## Résumé des changements à livrer

| Fichier / zone | Changement |
|---|---|
| `hooks/useVisualViewportHeight.ts` | nouveau hook, écoute `visualViewport` |
| `app/providers.tsx` (ou layout racine) | appel du hook une fois |
| `globals.css` | `--app-height`, `100dvh`, suppression des `calc(100vh - 8rem)` |
| `tailwind.config.ts` | utilitaires `safe-b`/`safe-t` |
| Composant zone de saisie | layout flex (`flex-1` messages / `flex-0` input), padding safe-area |
| `hooks/useRealtimeMessages.ts` | nouveau hook, remplace le `setInterval` de polling |
| Store Zustand (`chatStore`) | actions `addMessage`, `updateMessage`, `incrementUnread` branchées sur le channel |
| Supabase Dashboard | activer réplication Realtime sur `messages`, vérifier RLS `SELECT` |
| Composant Toast (shadcn) | déclenché sur INSERT hors conversation active, + `navigator.vibrate` + son |

Une fois ces trois chantiers faits, les trois symptômes décrits (texte caché sous le clavier, délai de 10s, mise en page cassée selon l'appareil) doivent disparaître ensemble, car ils partagent la même cause profonde côté layout (dépendance à des hauteurs statiques) et côté données (absence de canal réactif).
