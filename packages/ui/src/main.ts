import { createApp } from 'vue';
import App from './App.vue';
import { vExpoStep } from './directives/expoStep.js';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './style.css';

createApp(App)
  .directive('expo-step', vExpoStep)
  .mount('#app');
