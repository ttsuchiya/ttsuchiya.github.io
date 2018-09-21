<CsoundSynthesizer>
<CsOptions>
-odac -d
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 200
nchnls = 2
0dbfs = 1.0

zakinit 2, 1
giverbchL = 1
giverbchR = 2
turnon "VERB"

gkfreq init 0
gktrig init 0
turnon "MASTER"

instr MASTER
kfreq chnget "playbackSpeed"
gkfreq = expcurve(kfreq, 50)
gkfreq = expcurve(gkfreq, 50)
gkfreq = scale(gkfreq, 25, 0.1)
gktrig = metro(gkfreq)
endin

instr 1, TRIG
; ..., name, delay, duration, pitch, gain
schedkwhen gktrig, 0, 0, "GRAIN", p4 * 1/gkfreq, 0.1, p5, logcurve(p6, 30)
endin

instr 2, KILL
turnoff2 "GRAIN", 0, 1
endin

instr 3, GRAIN
iatk = 0.002
igain = p5 * 0.075
aenv = madsr:a(iatk, p3-iatk, 0, p3-iatk) * igain
asig oscil aenv, cpsmidinn(scale(p4,110,55))
outs asig, asig

asigL = asig
asigR = asig
iverbsend = 0.1
zawm asigL * iverbsend, giverbchL
zawm asigR * iverbsend, giverbchR
endin

instr +VERB
asigL zar giverbchL
asigR zar giverbchR
zacl giverbchL, giverbchR

denorm asigL, asigR
asigL, asigR reverbsc asigL, asigR, .8, sr/2

outs asigL, asigR
endin

</CsInstruments>
<CsScore>
</CsScore>
</CsoundSynthesizer>