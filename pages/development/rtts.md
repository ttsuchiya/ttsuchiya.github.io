# Time-Stretching Performance System
This was my 4-month development project at Electronic Music Production and Sound Design major at Berklee, in Spring 2012. I wanted to employ all my learning and experience in EPD &#8211; production, programming, and artistic expressions, but also wanted to try a new and challenging project for me.

---
<p style="text-align: center;">Prototype 1-3</p>
<p style="text-align: center;"><iframe src="https://player.vimeo.com/video/41556188?title=0&amp;byline=0&amp;portrait=0&amp;badge=0" height="313" width="500" frameborder="0"></iframe></p>

---
<p style="text-align: center;">Prototype 4 Overview</p>
<p>Tools:</p>
<ul>
<li>Arduino UNO (violin), Arduino FIO (glove), Xbee</li>
<li>sensors: SoftPot x2, FSR, Ultrasonic Distance Sensor, Accelerometer, Flex Sensor</li>
<li>Ableton Live</li>
<li>Max/MSP</li>
<li>Csound</li>
</ul>
<p>&nbsp;</p>
<p>Goal 1: Semi-Realtime</p>
<ul>
<li>accessibility &#8211; can control while playing the instrument normally</li>
<li>buffer based &#8211; instant recording and playback</li>
</ul>
<p>&nbsp;</p>
<p>Goal 2: Make It Modular</p>
<ul>
<li>software &#8211; many signal path options</li>
<li>hardware &#8211; easy to attach / detouch</li>
<li>wireless (glove control)</li>
</ul>
<p>&nbsp;</p>
<p>Core Features: Interfacing / Transfer Functions</p>
<ul>
<li>multiple input option for a single control &#8211; course &amp; fine, control &amp; gating, etc.</li>
<li>linear to &#8220;expon&#8221; (or multiple level of linear scaling) conversion</li>
<li>record / playback / loop range automation &#8211; automatically rescales</li>
<li>pitch scale control &#8211; from keyboard (via UDP network) or switching preset</li>
<li>playhead smoothing</li>
<li>MIDI CC &amp; keyboard mapping</li>
</ul>
<p>&nbsp;</p>
<p><img title="DSCN0571" alt="" src="http://www.loadmess.com/wp-content/uploads/2012/11/DSCN0571-1024x768.jpg" width="614" height="461" /></p>

---
<p style="text-align: center;">Audio Processing</p>
<p>Syncloop Granular Sampler</p>
<p><img class="alignnone  wp-image-368" title="SyncLoop005a" alt="" src="http://www.loadmess.com/wp-content/uploads/2012/11/SyncLoop005a-1024x143.png" width="529" height="74" srcset="http://www.loadmess.com/wp-content/uploads/2012/11/SyncLoop005a-300x42.png 300w, http://www.loadmess.com/wp-content/uploads/2012/11/SyncLoop005a-1024x143.png 1024w, http://www.loadmess.com/wp-content/uploads/2012/11/SyncLoop005a.png 1421w" sizes="(max-width: 529px) 100vw, 529px" /></p>
<p>Time stretcher / looper with quick and appendable recording (triggered by foot switch / note pattern / automatic background recording, etc.), loop range scaler which always updates the range to -1 to 1 for sensor input, course / fine inputs, pitch scaler via UDP, morphable window functions, and all basic granular synthesis controls.</p>
<p><a href="http://www.loadmess.com/wp-content/uploads/2012/11/SyncLoop007.zip">source</a> (MaxForLive, Csound)</p>
<p>&nbsp;</p>
<p>Delayline Arpeggiator</p>
<p><img class="alignnone  wp-image-367" title="delayArpFX002a" alt="" src="http://www.loadmess.com/wp-content/uploads/2012/11/delayArpFX002a-1024x198.png" width="390" height="75" srcset="http://www.loadmess.com/wp-content/uploads/2012/11/delayArpFX002a-300x58.png 300w, http://www.loadmess.com/wp-content/uploads/2012/11/delayArpFX002a-1024x198.png 1024w, http://www.loadmess.com/wp-content/uploads/2012/11/delayArpFX002a.png 1025w" sizes="(max-width: 390px) 100vw, 390px" /></p>
<p>FFT-based pitch shifter for delay lines, with rhythm control / randomization in Csound.</p>
<p><a href="http://www.loadmess.com/wp-content/uploads/2012/11/DelayArpFX002.zip">source</a> (MaxForLive, Csound)</p>
<p>&nbsp;</p>
<p>Pitchtracking Noise-Comb Synth</p>
<p>Csound pitch tracker to impulse / white noise / single cycle sampling random note generator.</p>

---
<p style="text-align: center;">Control Signal Modification &#8211; Snippets</p>
<p>Exponential Course / Fine</p>
<p>A bipolar linear to exponential scaler mainly used for the Time-Scaling control, where extra precision is required between the value -1.0 and 1.0. Outside this range, it can accelerate up to 100.0 (and -100.0).</p>
<p><a href="http://www.loadmess.com/wp-content/uploads/2012/11/ExponCourseFine.maxpat.zip">source</a> (Max)</p>
<p>&nbsp;</p>
<p>Inertial Input</p>
<p>Controls the acceleration instead of direct correspondence of the input motion / position to parameter. In this system, it is used with accelerometer sensor for limited mobility as well as for precise control. One can tilt the sensor slightly to slowly increase / decrease the value.</p>
<p><a href="http://www.loadmess.com/wp-content/uploads/2012/11/LinToAccel.maxpat.zip">source</a> (Max)</p>
<p>&nbsp;</p>
<p>Neck Slide Simulator</p>
<p>Used with MIDI keys / switch sensors. It starts sliding fast toward the destination value, and gradually decrease the speed.</p>
<p><a href="http://www.loadmess.com/wp-content/uploads/2012/11/SlideSim.maxpat.zip">source</a>(Max)</p>
<p>&nbsp;</p>
<p>No Leaping Smoother</p>
<p>Used with audio pitch tracker where it can pick up harmonics / error notes. This snippet prevents jumps beyond the specified value.</p>
<p><a href="http://www.loadmess.com/wp-content/uploads/2012/11/NoLeapSmoother.maxpat.zip">source</a> (Max)</p>
<p>&nbsp;</p>
<p>MIDI Note Scaler</p>
<p>A typical pitch scaler for MIDI note (0-127) or continuous controller input. I use this via UDP network to set the tone-row in separate plugin, or plugins in multiple computers.</p>
<p><a href="http://www.loadmess.com/wp-content/uploads/2012/11/MIDInoteScaler.maxpat.zip">source</a> (Max)</p>
<p>&nbsp;</p>
<p>Histogram-based pattern matching</p>
<p>Used with audio pitch tracker to trigger recording, playback, etc. based on a written score.</p>
<p><a href="http://www.loadmess.com/wp-content/uploads/2012/11/HistMatch.maxpat.zip">source</a> (Max)</p>
<p>&nbsp;</p>
<p style="text-align: center;">Glove Test: Parallel Mapping / Inertial Control</p>
<p style="text-align: center;"><iframe src="https://player.vimeo.com/video/55902774?title=0&amp;byline=0&amp;portrait=0&amp;badge=0" height="313" width="500" frameborder="0"></iframe></p>