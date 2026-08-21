Port Lenghts Paper by Linearteam
======

Source: https://jahonen.kapsi.fi/Audio/Papers/Portlengths.pdf

Compares the port length predictions of various software and end-correction factors vs WinIsd
and documents the WinIsd air constants.

Speed of sound: 343.68
End correction: 0.732

Excerpt
----

Most of the ”manual” formulas represented here produce identical results for all practical purposes.
There is no any significant difference among them. Some software seems not to use directly the
given data (or the classic tuning formula derived here). That is readily obvious from the results
obtained.

From the calculated values, it can be said, that most enclosure design software use the same
formula, but each software author has specific taste of what is considered as ”correct” speed of
sound. As mentioned in Claus Futtrup’s excellent Driver Parameter Calculator manual, the speed
of sound is not very trivial topic.

In car-fi environment, the environment temperature variations may be extremely high, I can
see that span of some 60◦C is not unusual. That changes tunings quite a bit. It is very much
larger change than differences between different software.

WinISD is the only software in comparison which lets user to specify the temperature, humidity
and ambient air pressure where to perform the port calculation.

Unless I receive a good scientific basis why LspCAD calculates port obviously very different
way than rest of the software, I am somewhat sceptic. It is probably more relevant to discuss,
whether the environment conditions are correct, when port length is calculated.

The correct port length is not exact science, and none of the tested software produces any more
correct results than the others, considering all the nonidealities found in practical box building.