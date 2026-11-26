import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { HttpClient } from '@angular/common/http';
import { enableProdMode } from '@angular/core';
import { environment } from './app/shared/environments/environment';

enableProdMode();

if (!environment.enableLogging) {
  const noop = () => {};
  for (const method of ['log', 'info', 'debug', 'warn', 'error', 'trace', 'table', 'dir'] as const) {
    console[method] = noop;
  }
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

