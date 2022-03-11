<CsoundSynthesizer>
<CsOptions>
-odac -iadc
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 1
nchnls = 2
0dbfs = 1.0

gkDelL init 0.001
gkDelR init 0.001
gkAttenL init 0
gkAttenR init 0

turnon "CALC_EXT"

instr CALC_EXT
gkX chnget "x"
gkY chnget "y"
gkDelL chnget "leftDelay"
gkDelR chnget "rightDelay"
gkAttenL chnget "leftIntensity"
gkAttenR chnget "rightIntensity"
endin

instr CHIRP
iGain = 0.25
iDur = 0.05

aAmpEnv = madsr:a(0.001,iDur,0,0.01)
aFreqEnv = line:a(5000,iDur,10)
asig = oscil:a(iGain * aAmpEnv, aFreqEnv)
asigL, asigR pan2 asig, (gkX-0.5)*(1-gkY)+0.5

iDelL = i(gkDelL)
iDelR = i(gkDelR)
adelL delay asigL, iDelL
adelR delay asigR, iDelR

iDryGain = 0.25
aoutL = asig * iDryGain + adelL * gkAttenL
aoutR = asig * iDryGain + adelR * gkAttenR
outs aoutL, aoutR
endin


</CsInstruments>
<CsScore>
</CsScore>
</CsoundSynthesizer>