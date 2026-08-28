# OpenISD field reference

Every field OpenISD reads, writes, or shows — what it means, what unit it is in, and where that
definition comes from.

**Two names per parameter, and they are deliberately different.** The stored record uses WinISD's
own name (`Fs`, `Sd`, `Cms`); the public API adds the unit (`Fs_hz`, `Sd_m2`, `Cms_m_per_N`). A
caller reading a number is the one who can get the unit wrong, so the unit is on the name they
read. Dimensionless quantities take no suffix, because they have no unit.

**Everything OpenISD stores is SI**, whatever the datasheet printed. A record states both:

```yaml
Sd:
  readings:
    manufacturer_product_page:
      actual_reading: '1217 cm2'     # what the datasheet said
      read_value: 0.1217             # what we store, always SI
  definition: 'effective piston area — stored in m², not cm²'
```

## Sources

| Tag | Source |
| --- | --- |
| **WH** | WinISD Pro help, `Thiele/Small Specs — What They Mean` (`docs/winisd_helpfiles/help/thielesmall.html`). The parameter explanations there were "originally written by Claus Futtrup and used here with permission"; the page itself is by JJ Richard, revised by Janne Ahonen. |
| **CF** | Claus Futtrup, *DPC Formulas* — <https://www.cfuttrup.com/dpc/formulas.htm> |
| **GH** | This project's own decompilation of the WinISD binary, `winisd_research/GHIDRA_FINDINGS.md`, with each relation confirmed against live runs of the real program. |
| **BX** | WinISD Pro help, `Box design` (`docs/winisd_helpfiles/help/boxdesign.html`). |

WH and CF share an author for the parameter definitions, so where they agree that is one
source stated twice, not two independent ones. GH is independent of both — it reads the shipped
program.

---

## Driver — Thiele/Small

| API name | Record | Unit | Meaning |
| --- | --- | --- | --- |
| `Fs_hz` | `Fs` | Hz | Free-air resonance frequency of the driver. WH |
| `Qes` | `Qes` | — | Electrical Q (damping). Lower means more damping. How readily the driver resonates at `Fs` by electrical means. WH |
| `Qms` | `Qms` | — | Mechanical Q (damping). Same idea, by mechanical means. WH |
| `Qts` | `Qts` | — | Total damping — `Qms` and `Qes` in parallel: `1/(1/Qms + 1/Qes)`. WH · CF |
| `Vas_m3` | `Vas` | m³ | The volume of air whose springiness equals the driver's own suspension compliance. WH |
| `Re_ohm` | `Re` | Ω | DC resistance of the voice coil. WH |
| `Znom_ohm` | `Znom` | Ω | Nominal impedance. **Not used in simulation.** WH |
| `Le_H` | `Le` | H | Voice-coil inductance. WH |
| `fLe_hz` | `fLe` | Hz | The frequency at which `Le` and `KLe` are determined. WH |
| `KLe_H_sqrtHz` | `KLe` | H·√Hz | Voice-coil **semi**-inductance, after Vanderkooy. `KLe = Le·√(2π·fLe)`. WH · CF · GH |
| `BL_Tm` | `BL` | T·m | Magnetic induction crossed with the wire length in the airgap — the motor force factor. WH |
| `Mms_kg` | `Mms` | kg | Mechanical mass of the moving parts, **including** the air load. WH |
| `Cms_m_per_N` | `Cms` | m/N | Compliance of the driver — the inverse of spring stiffness. WH |
| `Rms_kg_per_s` | `Rms` | kg/s | Mechanical damping from friction, including the resistive part of the radiation load. Larger `Qms` gives smaller `Rms`. WH |
| `Sd_m2` | `Sd` | m² | Effective surface area of the diaphragm. WH |
| `Dd_m` | `Dd` | m | Diameter of the diaphragm. WH |
| `Dia_m` | `Dia` | m | Nominal driver diameter. CF |
| `Vd_m3` | `Vd` | m³ | Volume displacement — how much air the driver moves over its linear range. `Vd = Xmax·Sd`. WH · CF |
| `EBP_hz` | `EBP` | Hz | Efficiency–bandwidth product, `Fs/Qes`. A rough sealed-versus-vented indicator. WH · CF |

## Driver — large signal and power

| API name | Record | Unit | Meaning |
| --- | --- | --- | --- |
| `Xmax_m` | `Xmax` | m | Maximum **linear** excursion, usually `abs(Hc−Hg)/2`. WinISD applies no 1.15/0.87 fudge factor, and wants the peak (one-way) value. Some manufacturers wrongly quote the damage limit here — that is `Xlim`. WH |
| `Xlim_m` | `Xlim` | m | Damage-limit excursion, also a peak value. WH |
| `Hc_m` | `Hc` | m | Height of the voice coil. WH |
| `Hg_m` | `Hg` | m | Height of the magnetic airgap. WH |
| `Pe_W` | `Pe` | W | Thermally limited maximum **continuous** power. Driven above it continuously, the driver eventually fails. WH |
| `power_peak_W` | `power_peak_W` | W | Short-term / peak power handling. Our own field; not a WinISD one. |
| `numVC` | `numVC` | — | How many voice coils. An ordinary driver has 1, a dual-voice-coil driver 2. WH |
| `VCCon` | `VCCon` | — | Voice-coil wiring, series or parallel. WinISD's editor combo `edConMode`. GH |

**Neither is a simulation input.** In WinISD the wiring combo performs a ONE-SHOT REWRITE of the
driver's stored `Re` and `BL` at the moment it changes — parallel→series multiplies `BL` by
`numVC` and `Re` by `numVC²` — and nothing reads either field during a simulation (decompiled,
`winisd_research` FINDING-009). The arithmetic is correct physics: `N` coils of resistance `r`
give `r/N` in parallel and `N·r` in series.

**OpenISD deviates deliberately.** WinISD leaves the rewritten value marked as *entered by the
user*, so the file claims you typed a number the app computed. OpenISD keeps two fields instead —
`Re` per coil (what you type, never rewritten) and the terminal value as wired (derived, shown
read-only on the Placement panel beside the wiring control). The `.wdr`/`.wpr` files stay
byte-compatible: the writer emits the terminal values, exactly what WinISD would have written.
See `docs/research/WINISD_PARITY.md` §11b and ledger QO96.

**Reading a WinISD file back.** A `.wdr` carries one `Re`, always the terminal value, and its
`VCCon` cannot be trusted — WinISD's own dropdown writes `1` whatever you selected. OpenISD trusts
the file's `VCCon` anyway, and that is safe because the same factor is applied on the way in and
on the way back out, so it cancels: the terminal `Re` reaching the simulation is the file's own
`Re` byte for byte, and a file read then rewritten is unchanged. **The only thing a mis-saved
`VCCon` affects is the per-coil figure shown on screen**, and only when `numVC` is above 1 — for a
single-coil driver the factor is 1 and there is nothing to get wrong. Ledger QO97.

## Driver — sensitivity

| API name | Record | Unit | Meaning |
| --- | --- | --- | --- |
| `SPL_dB` | `SPL` | dB | Power sensitivity — dB per watt, 1 m, half-space. Directly related to `no`. WinISD warns this is not an "accurate" figure in application: do not substitute a manufacturer's own number unless you need it to derive other parameters. WH |
| `USPL_dB` | `USPL` | dB/2.83V | **Voltage** sensitivity — dB per 2.83 V. On an 8 Ω driver 2.83 V is 1 W and the two agree; at lower impedance `USPL` rises. Closer to how voltage amplifiers actually drive a speaker. WH |
| `no` | `no` | — | Efficiency η₀, a percentage. WH · CF |
| `SPLmax_dB` | `SPLmax` | dB | Maximum thermally limited SPL into 2π, at `Pe`, assuming 3 dB of power compression: `SPL + 10·log₁₀(Pe) − 3`. Confirmed on 34 live runs. WH · CF · GH |
| `SPLmaxLF_dB` | `SPLmaxLF` | dB | How loud the driver can play at 20 Hz in a closed box or infinite baffle, at maximum excursion, 1 m into half-space. Gives a feel for `Vd`. Does **not** apply to vented or other assisted enclosures. WH |

## Driver — thermal

WinISD displays all three. **None is used in any simulation** — WinISD says so itself, and OpenISD
matches that.

| API name | Record | Unit | Meaning |
| --- | --- | --- | --- |
| `alfaVC_per_K` | `alfaVC` | 1/K | Resistance temperature coefficient of the voice-coil material — the relative change in `Re` per kelvin. Copper is about 0.0039 /K at +20 °C. WH |
| `Rt_K_per_W` | `Rt` | K/W | Thermal resistance from voice coil to the ambient air in the box. WH |
| `Ct_J_per_K` | `Ct` | J/K | Thermal capacity of the voice-coil assembly. WH |

## Driver — figures of merit

Calculated summaries of how good the motor is. WinISD shows them; nothing simulates from them.

| API name | Record | Unit | Meaning |
| --- | --- | --- | --- |
| `Rme_kg_per_s` | `Rme` | kg/s | Electromagnetic damping factor, `BL²/Re` — the mechanical control the motor exerts on the diaphragm. `Rme` is to `Qes` what `Rms` is to `Qms`. WH · CF |
| `gamma_m_per_s2_A` | `gamma` | m/(s²·A) | The acceleration factor — acceleration per ampere, `BL/Mms`. WinISD's UI prints it as `N/(A·kg)`, which is the same dimension. WH · CF |
| `Mpow_N_per_sqrtW` | `Mpow` | N/√W | Motor power factor, `BL/√Re` (equivalently `√Rme`). Futtrup's own preference over `Rme`: it reads in newtons and is independent of the driver's impedance, so it does not favour high- or low-impedance drivers. WH · CF |
| `Mcost_kg_per_s` | `Mcost` | kg/s (= N·s/m) | Motor **cost** factor: `Rme·(1 + Xmax/min(Hc, Hg))`. How powerful the motor is, penalised by how overhung or underhung the coil is — an extension suggested by T. L. Clarke. An indicator of what the driver costs to build. WinISD's own advice: *"please forget about the unit."* The `min()` is proven, not assumed: two probe runs swapping which of `Hc`/`Hg` is smaller return an identical value. WH · CF · GH |
| `Gloss` | `Gloss` | — | How far the cone sags under gravity when the driver is mounted facing up, as a fraction of `Xmax`, shown as a percentage: `g/((2π·Fs)²·Xmax)`, with `g` = 9.80665 m/s². Over about 5% means the driver should not be mounted horizontally. Slightly over-pessimistic, because surrounding air lowers the real resonance. WH · CF · GH |

## Driver — dimensions

| API name | Record | Unit | Meaning |
| --- | --- | --- | --- |
| `Thick_m` | `Thick` | m | Thickness of the basket plate. WH |
| `Depth_m` | `Depth` | m | Overall depth of the driver. WH |
| `MagDepth_m` | `MagDepth` | m | Magnet depth — the cylinder height. WH |
| `Magnet_m` | `Magnet` | m | Magnet diameter. WH |
| `Basket_m` | `Basket` | m | Basket diameter — **the hole to cut in the baffle**. WH |
| `Outer_m` | `Outer` | m | Outer diameter — the space to leave on the baffle. WH |
| `OuterX_m` / `OuterY_m` | `OuterX` / `OuterY` | m | Outer extent on each axis, for a driver that is not round. Our own fields. |
| `Vcd_m` | `Vcd` | m | Voice-coil diameter. WH |
| `DVol_m3` | `DVol` | m³ | Driver displacement volume — roughly the box volume the driver itself occupies, mounted magnet-inwards. Subtract it from the internal volume. WH |
| `weight_kg` | `weight_kg` | kg | Net driver weight. Our own field. |
| `freq_low_hz` / `freq_high_hz` | same | Hz | Usable/recommended frequency range. Our own fields. |

## The air the driver states

| API name | Record | Unit | Meaning |
| --- | --- | --- | --- |
| `c_m_per_s` | `c` | m/s | Speed of sound. |
| `roo_kg_per_m3` | `roo` | kg/m³ | Air density. |

**These are not the simulation's environment.** WinISD offers both for editing on the *driver* and
saves what you type; a `.wpr` stores them inside its `[Driver]` section, not a project-level one.
They are what that driver's own figures were measured or computed at. The project's own
temperature, humidity and pressure are what a simulation runs on.

## Passive radiator

A passive radiator has a cone, a suspension and a mass, but **no motor and no voice coil**. So it
carries none of `Re`, `Le`, `BL`, `Qes`, `Qts`, `Znom`, `Pe`, `SPL`, the thermal parameters, or
anything about a magnet.

It states: `Fs_hz`, `Qms`, `Cms_m_per_N`, `Mms_kg`, `Rms_kg_per_s`, `Sd_m2`, `Vas_m3`, `Vd_m3`,
`Xmax_m`, `Xlim_m`, `Dia_m`, `Dd_m`, `DVol_m3`, plus the mounting dimensions `Thick_m`,
`Depth_m`, `Basket_m`, `Outer_m`, `OuterX_m`, `OuterY_m`, `weight_kg` — and `brand` / `model`,
because a radiator is a product you buy. Each means exactly what the driver table above says.

## Box losses

Every one is a Q factor, so **smaller means more loss**. BX

| Field | Applies to | Meaning |
| --- | --- | --- |
| `Ql` | every box | **Leakage** losses — leaks in the enclosure or through the driver itself. The dominant loss in a vented box. Typical 5–20, and effectively impossible to predict before the box is built. BX |
| `Qa` | every box | **Absorption** losses inside the enclosure. Stuffing increases absorption, so it *lowers* this number. Empty box ≈ 100; heavily stuffed ≈ 3–5. BX |
| `Qp` | vented, bandpass | **Port** losses — air does not move through a port without friction. Set it very low and a vented box behaves as a closed one. BX |
| `Qicl` | bandpass | Inter-chamber coupling loss. |

**These are not cosmetic.** The sealed resonance OpenISD reports is the lossy one, the same figure
WinISD displays and saves — measured on the real program, it shifts 5.8 Hz for a change in `Ql`
alone at fixed volume (`winisd_research` FINDING-007).

## Box geometry

| Field | Unit | Meaning |
| --- | --- | --- |
| `volume_m3` | m³ | Internal volume of the chamber, net of what the driver and any bracing occupy. |
| `tuning_hz` | Hz | The port's tuning frequency, `Fb`. |
| `resonance_hz` | Hz | **Calculated, not entered.** The driver's resonance as raised by the box — WinISD's `Fc` for a sealed box, `Frc` for a bandpass rear chamber. |
| vent `shape` | — | Round or slotted. Which dimensions matter follows this. |
| vent `diameter_m` | m | Round port diameter. |
| vent `width_m` / `height_m` | m | Slotted port dimensions. |
| vent `length_m` | m | Physical port length. |
| vent `endCorrection_m` | m | The added effective length from air moving at the port's ends — the port behaves acoustically longer than it measures. |

## Environment and signal

| Field | Unit | Meaning |
| --- | --- | --- |
| `temperature_K` | K | Air temperature the simulation runs at. |
| `humidity_pct` | % | Relative humidity. |
| `pressure_Pa` | Pa | Ambient pressure. |
| `power_W` | W | Drive power. |
| `voltage_V` | V | Drive voltage. |

Temperature, humidity and pressure together set the air's density and speed of sound, which is
what they exist to do — the driver's own `c` and `roo` are a separate thing (above).

## A note on where numbers come from

Every stored value carries its **origin** — which source it was read from, what the source
literally printed, and how precisely it could be read. A parameter a datasheet does not state is
**absent** from the record, not present holding zero. Zero is a value; absence is not.

That distinction matters in use: `Znom` is genuinely 0 in some real `.wdr` files, and WinISD
treats that zero as a stated fact rather than as "unset".
