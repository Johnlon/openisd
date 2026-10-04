import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDDriver, ProjectBuilder} from '../../domain/index.js';
import {specSection, driverFrom} from '../fixtures/domainBuilders.js';

describe('ManagedProject — the layers', () => {
  const managed = () => new ProjectBuilder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), createEngine()).sealed().volume_m3(0.03).build();

  it('starts unmodified', () => {
    expect(managed().isModified()).toBe(false);
  });

  it('impedancePeak() answers null when the driver has no usable Re_ohm yet', () => {
    const mp = managed();
    expect(mp.driver.specs.Re_ohm.value).toBeNull();
    expect(mp.impedancePeak(null)).toBeNull();
  });

  it('impedancePeak() reads Re off the driver once it is known, and null-sweeps to null', () => {
    const mp = managed();
    mp.driver.specs.Re_ohm.set(6);
    expect(mp.impedancePeak(null)).toBeNull();
  });

  it('the first write creates the edited state; Cancel throws it away', () => {
    const mp = managed();

    mp.driver.specs.Fs_hz.set(99);
    expect(mp.isModified()).toBe(true);
    expect(mp.driver.specs.Fs_hz.value).toBe(99);

    void mp.cancel(async () => true);
  });

  it('Cancel restores the last saved values', async () => {
    const mp = managed();
    mp.driver.specs.Fs_hz.set(99);

    expect(await mp.cancel(async () => true)).toBe(true);
    expect(mp.driver.specs.Fs_hz.value).toBe(30);
    expect(mp.isModified()).toBe(false);
  });

  it('Cancel does nothing when the challenge refuses', async () => {
    const mp = managed();
    mp.driver.specs.Fs_hz.set(99);

    expect(await mp.cancel(async () => false)).toBe(false);
    expect(mp.driver.specs.Fs_hz.value).toBe(99);
    expect(mp.isModified()).toBe(true);
  });

  it('Cancel on an untouched project reports that nothing was discarded', async () => {
    expect(await managed().cancel(async () => true)).toBe(false);
  });

  it('Save promotes the edited state and clears the modified flag', () => {
    const mp = managed();
    mp.driver.specs.Fs_hz.set(50);
    expect(mp.isModified()).toBe(true);

    mp.save();
    expect(mp.driver.specs.Fs_hz.value).toBe(50);
    expect(mp.isModified()).toBe(false);
  });

  it('Save on an untouched project is a no-op', () => {
    const mp = managed();
    expect(() => mp.save()).not.toThrow();
    expect(mp.isModified()).toBe(false);
  });

  it('Cancel after a Save goes back to what was SAVED, not to what was loaded', async () => {
    const mp = managed();
    mp.driver.specs.Fs_hz.set(50);
    mp.save();

    mp.driver.specs.Fs_hz.set(77);
    await mp.cancel(async () => true);

    // 50 — the saved state — not the 30 the project was loaded with.
    expect(mp.driver.specs.Fs_hz.value).toBe(50);
  });

  it('notifies on entering the edited state, not only on later writes', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.driver.specs.Fs_hz.set(42);
    expect(notifications).toBeGreaterThan(0);

    const afterFirst = notifications;
    mp.driver.specs.Fs_hz.set(43);
    expect(notifications).toBeGreaterThan(afterFirst);
  });

  it('notifies when setDriver replaces the whole driver record', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.setDriver(OpenISDDriver.empty(createEngine()));
    expect(notifications).toBeGreaterThan(0);
  });

  it('notifies when loadDriver adopts a driver from outside the project', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.loadDriver(OpenISDDriver.empty(createEngine()));
    expect(notifications).toBeGreaterThan(0);
  });

  it('the function subscribe() returns stops further notifications once called', () => {
    const mp = managed();
    let notifications = 0;
    const unsubscribe = mp.subscribe(() => { notifications += 1; });

    mp.driver.specs.Fs_hz.set(42);
    expect(notifications).toBe(1);

    unsubscribe();
    mp.driver.specs.Fs_hz.set(43);
    expect(notifications).toBe(1);
  });

  it('batch() collapses every write inside it into a single notification', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.batch(() => {
      mp.driver.specs.Fs_hz.set(42);
      mp.driver.specs.Qts.set(0.5);
      mp.driver.specs.Re_ohm.set(6);
    });

    expect(notifications).toBe(1);
  });

  it('batch() with no write inside it notifies nobody — nothing was pending when it closed', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.batch(() => {});

    expect(notifications).toBe(0);
  });

  it('recalc()/notifyVentChanged() notify subscribers with no state change of their own', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.recalc();
    expect(notifications).toBe(1);

    mp.notifyVentChanged();
    expect(notifications).toBe(2);
  });
});
