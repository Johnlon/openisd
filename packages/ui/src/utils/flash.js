import { ref } from 'vue';
export const flashMsg = ref('');
export function flash(msg) {
  flashMsg.value = msg;
  setTimeout(() => { flashMsg.value = ''; }, 2000);
}
