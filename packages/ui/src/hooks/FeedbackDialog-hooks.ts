import {computed, inject, provide, ref, type App, type ComputedRef, type InjectionKey, type Ref} from 'vue';
import type {KeyValueStorage} from '@openisd/persistence';
import {
  FEEDBACK_TEXTS, FeedbackFace, feedbackAskAfter, feedbackAskDue, parseFeedbackAskState, type FeedbackAskEvent,
} from '@openisd/design/fields';
import type {FeedbackDelivery, FeedbackOutbox} from '../logic/feedback/feedbackOutbox.js';
import type {Skin} from '../logic/telemetry/events.js';

/** The storage key of the "when did we last ask" state. */
export const FEEDBACK_ASK_KEY = 'openisd_feedback_ask_v1';

/** Where the app hears that the user saved a project. */
export interface UserSaves {
  onUserSave(listener: () => void): () => void;
}

/** Where the app hears that the network is back. */
export interface OnlineAgain {
  listen(listener: () => void): () => void;
}

export interface FeedbackDialogDeps {
  readonly outbox: FeedbackOutbox;
  readonly storage: KeyValueStorage;
  readonly now: () => number;
  readonly skin: () => Skin;
  /** The screen the user is on, as a crash report names it. */
  readonly screen: () => string;
  /** True while another dialog, the welcome screen, the What's new popup or the update banner is up. */
  readonly busy: () => boolean;
  readonly userSaves: UserSaves;
  readonly onlineAgain: OnlineAgain;
  /** Runs `fn` a moment later, so the prompt does not land on the save's own confirmation. */
  readonly defer: (fn: () => void) => void;
}

/** The click or tap that asks for a send. A send is made only for a real one (`isTrusted`): the app has no
 *  programmatic way to send an answer. */
export interface UserAction {
  readonly isTrusted: boolean;
}

export type FeedbackPhase = 'face' | 'comment';
export type FeedbackSource = 'menu' | 'prompt';

export interface FeedbackDialogApi {
  readonly open: Readonly<Ref<boolean>>;
  readonly source: Readonly<Ref<FeedbackSource>>;
  readonly phase: Readonly<Ref<FeedbackPhase>>;
  readonly faces: readonly FeedbackFace[];
  /** The wire value of the face tapped, or null before a tap (a member is never held in a ref: Vue's proxy breaks `===`). */
  readonly chosen: Readonly<Ref<string | null>>;
  readonly heading: ComputedRef<string>;
  /** The one confirmation line: "Thanks, sent" or "Saved, will send when online" for what the user has given (the face,
   *  then the face and the comment); '' before a tap. A comment updates this line; it never adds a second one (T881). */
  readonly statusText: ComputedRef<string>;
  readonly comment: Ref<string>;
  readonly commentSent: Readonly<Ref<boolean>>;
  readonly texts: typeof FEEDBACK_TEXTS;
  /** True on the phone skin: the dialog is a bottom sheet with bigger faces. */
  readonly phone: ComputedRef<boolean>;
  /** The Info menu's "Send feedback": always opens, whatever the quiet time. */
  show(): void;
  /** One tap sends the answer. */
  pickFace(face: FeedbackFace, action: UserAction): Promise<void>;
  /** Send what was typed as a follow-up. Blank: nothing is sent and the dialog just closes. */
  sendComment(action: UserAction): Promise<void>;
  /** Not now, Escape, outside tap or Close. */
  dismiss(): void;
  stop(): void;
}

function statusLine(delivery: FeedbackDelivery | null): string {
  if (delivery === null) return '';
  return delivery === 'sent' ? FEEDBACK_TEXTS.thanksSent : FEEDBACK_TEXTS.savedOffline;
}

/**
 * The feedback dialog and the occasional prompt. One tap on a face sends the answer (kept on the device
 * when offline); the comment is an optional follow-up. The prompt follows a user save, at most once in
 * 60 days, never over another dialog.
 */
export function createFeedbackDialog(deps: FeedbackDialogDeps): FeedbackDialogApi {
  const open = ref(false);
  const source = ref<FeedbackSource>('menu');
  const phase = ref<FeedbackPhase>('face');
  const chosen = ref<string | null>(null);
  const answerId = ref<string | null>(null);
  /** Where the answer (with its comment, once one is sent) stands: the outbox tracks both under one id. */
  const delivery = ref<FeedbackDelivery | null>(null);
  const comment = ref('');
  const commentSent = ref(false);

  function askNow(): ReturnType<typeof parseFeedbackAskState> {
    return parseFeedbackAskState(deps.storage.get(FEEDBACK_ASK_KEY));
  }

  function remember(event: FeedbackAskEvent): void {
    deps.storage.set(FEEDBACK_ASK_KEY, JSON.stringify(feedbackAskAfter(askNow(), event, deps.now())));
  }

  function reset(from: FeedbackSource): void {
    source.value = from;
    phase.value = 'face';
    chosen.value = null;
    answerId.value = null;
    delivery.value = null;
    comment.value = '';
    commentSent.value = false;
    open.value = true;
  }

  function mayPrompt(): boolean {
    return !open.value && !deps.busy() && feedbackAskDue(askNow(), deps.now());
  }

  const stopSaves = deps.userSaves.onUserSave(() => {
    if (!mayPrompt()) return;
    deps.defer(() => {
      if (!mayPrompt()) return;
      remember('shown');
      reset('prompt');
    });
  });

  const stopOnline = deps.onlineAgain.listen(() => {
    void deps.outbox.flush().then(() => {
      const id = answerId.value;
      if (id !== null && deps.outbox.deliveryOf(id) === 'sent') delivery.value = 'sent';
    });
  });

  return {
    open, source, phase, chosen, comment, commentSent,
    faces: FeedbackFace.ALL,
    texts: FEEDBACK_TEXTS,
    phone: computed(() => deps.skin() === 'mobile'),
    heading: computed(() => phase.value === 'face' ? FEEDBACK_TEXTS.title : FEEDBACK_TEXTS.thanks),
    statusText: computed(() => statusLine(delivery.value)),
    show: () => reset('menu'),
    async pickFace(face, action) {
      if (!action.isTrusted || chosen.value !== null) return;
      chosen.value = face.value;
      phase.value = 'comment';
      remember('answered');
      const answered = await deps.outbox.answer(face, deps.screen(), deps.skin());
      answerId.value = answered.id;
      delivery.value = answered.delivery;
    },
    async sendComment(action) {
      if (!action.isTrusted) return;
      const id = answerId.value;
      const text = comment.value.trim();
      if (id === null || text === '') { open.value = false; return; }
      delivery.value = await deps.outbox.comment(id, text);
      commentSent.value = true;
    },
    dismiss() {
      if (!open.value) return;
      if (source.value === 'prompt' && chosen.value === null) remember('not_now');
      open.value = false;
    },
    stop() {
      stopSaves();
      stopOnline();
    },
  };
}

const FeedbackDialogKey: InjectionKey<FeedbackDialogApi> = Symbol('openisd.feedbackDialog');

/** App.vue creates the one dialog and hands it to the shells' menus and the dialog component. */
export function provideFeedbackDialog(api: FeedbackDialogApi): void {
  provide(FeedbackDialogKey, api);
}

export function injectFeedbackDialog(): FeedbackDialogApi {
  const api = inject(FeedbackDialogKey);
  if (api === undefined) throw new Error('injectFeedbackDialog(): App.vue must call provideFeedbackDialog()');
  return api;
}

/** What main.ts gives App.vue to build the dialog from. */
export interface FeedbackServices {
  readonly outbox: FeedbackOutbox;
  readonly storage: KeyValueStorage;
  readonly userSaves: UserSaves;
  readonly onlineAgain: OnlineAgain;
  readonly screen: () => string;
}

const FeedbackServicesKey: InjectionKey<FeedbackServices> = Symbol('openisd.feedbackServices');

export function provideFeedbackServices(app: App, services: FeedbackServices): void {
  app.provide(FeedbackServicesKey, services);
}

export function injectFeedbackServices(): FeedbackServices {
  const s = inject(FeedbackServicesKey);
  if (s === undefined) throw new Error('injectFeedbackServices(): main.ts must call provideFeedbackServices()');
  return s;
}
