<p>Csound is a quite versatile audio synthesis software. However, it&#8217;s native language lacks a little in the interfacing aspects, such as real-time control input and visual output, where other developing environment such as Max/MSP that wraps the Csound API comes handy. Here I will introduce some of the Csound instruments built within MaxForLive as well as Android.</p>

---
<p style="text-align: center;"><a title="Csound For Live" href="http://www.csoundforlive.com/" target="_blank">Csound For Live</a> Project</p>
<p style="text-align: left;">Colman O&#8217;Reilly, a Berklee College alumni, started this project in 2010-11 with Dr. Richard Boulanger. I joined the developer team in summer 2011 &#8211; since then, I have been extensively involved in designing new instruments, updating and maintaining the entire collection, and doing workshops in many places.</p>
<p>&nbsp;</p>
<p style="text-align: center;">Image Scanning Vocoder (beta)</p>
<p style="text-align: center;"><iframe src="http://player.vimeo.com/video/56811353?title=0&amp;byline=0&amp;portrait=0&amp;badge=0" height="281" width="500" frameborder="0"></iframe></p>
<p>&nbsp;</p>
<p style="text-align: center;">Additive Node Synth (beta)</p>
<p style="text-align: center;"><iframe src="http://player.vimeo.com/video/56819675?title=0&amp;byline=0&amp;portrait=0&amp;badge=0" height="281" width="500" frameborder="0"></iframe></p>
<p>&nbsp;</p>

---
<p style="text-align: center;">Old Stuff</p>
<p style="text-align: left;"><a title="tablemorphing" href="http://www.csoundforlive.com/sixpacks/tablemorphing.html" target="_blank">TableMorphing</a> &#8211; a set of 5 instruments and 1 LFO that focuses on Csound&#8217;s various wavetable generation and manipulation techniques. Individual demo videos are coming&#8230; In the meantime, please see the <a title="UCSB Csound Workshop" href="/tsuchiya/portfolio/concerts/ucsb/" target="_blank">UCSB Csound Workshop page</a> for a demo piece featuring these instruments.</p>
<p><a title="samplers" href="http://www.csoundforlive.com/samplers.html" target="_blank">Samplers</a> &#8211; I made the PhaseVocoder, ResCombFilter, and Diskin Sampler.</p>
<p>&nbsp;</p>
<p style="text-align: center;">PhaseVocoder Sampler Demo</p>
<p style="text-align: center;"><iframe src="http://player.vimeo.com/video/53229081?title=0&amp;byline=0&amp;portrait=0&amp;badge=0" height="281" width="500" frameborder="0"></iframe></p>

---
<p style="text-align: center;">Real-Time Stretcher v01 for Android</p>
<p style="text-align: center;"><iframe src="http://player.vimeo.com/video/55902603?title=0&amp;byline=0&amp;portrait=0&amp;badge=0" height="313" width="500" frameborder="0"></iframe></p>
<p>Developed with Android Java+ Csound SDK. It processes live audio with variable time delay + sample &amp; hold + window function (rectangular-ish). It has Time Scaling (from 1 to -1) and Interval (or window size: 1ms to 100ms) control.</p>
<p><a href="http://www.loadmess.com/wp-content/uploads/2012/11/AdrRTTScsd001.zip">installer</a> (apk)</p>