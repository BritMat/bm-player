/* MilkDrop presets from butterchurn-presets (MIT, https://github.com/jberg/butterchurn-presets),
   the set named in scripts/milkdrop-presets.json, with their equations written out as
   functions by scripts/build-milkdrop.mjs. Generated: do not edit. */
export const PRESETS = {
"11":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1.98,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"wave_mode":2,"wave_dots":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken_center":1,"darken":1,"wave_a":0.001,"wave_scale":5.552,"wave_smoothing":0.504,"wave_mystery":-1,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpanimspeed":1.459,"warpscale":2.007,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_g":0,"wave_b":0,"ob_r":1,"ob_g":1,"ob_b":1,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0,"b1ed":0},"warp":" shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1 = (((uv - vec2(0.5, 0.5)) * texsize.xy) * 0.015);\n  vec4 tmpvar_2;\n  tmpvar_2.w = 1.0;\n  tmpvar_2.xyz = (((0.995 * texture (sampler_main, \n    (uv + (((\n      (clamp ((sin(tmpvar_1) / cos(tmpvar_1)), vec2(-12.0, -12.0), vec2(12.0, 12.0)) * cos(((4.0 * \n        (q2 + 1.0)\n      ) * tmpvar_1.yx)))\n     * texsize.zw) * 4.0) * (2.0 + q1)))\n  ).xyz) + vec3(0.01, 0.01, 0.01)) - 0.02);\n  ret = tmpvar_2.xyz;\n }","comp":" shader_body { \n  vec3 crisp_1;\n  vec2 uv3_2;\n  vec2 uv2_3;\n  vec2 tmpvar_4;\n  tmpvar_4 = ((uv - 0.5) * aspect.xy);\n  float tmpvar_5;\n  tmpvar_5 = (0.1 / (sqrt(\n    dot (tmpvar_4, tmpvar_4)\n  ) + 0.1));\n  vec2 tmpvar_6;\n  float tmpvar_7;\n  tmpvar_7 = (ang / 3.14);\n  tmpvar_6.x = tmpvar_7;\n  tmpvar_6.y = tmpvar_5;\n  uv2_3.y = (tmpvar_5 + (0.1 * time));\n  uv2_3.x = tmpvar_6.x;\n  vec2 tmpvar_8;\n  tmpvar_8.x = tmpvar_7;\n  tmpvar_8.y = (tmpvar_5 * 1.5);\n  uv3_2.y = (tmpvar_8.y + (0.08 * time));\n  uv3_2.x = (tmpvar_7 + (time / 32.0));\n  crisp_1 = (((2.0 * texture (sampler_main, uv2_3).xyz) + texture (sampler_main, uv3_2).xyz) + ((2.0 * \n    ((texture (sampler_blur2, fract(uv2_3)).xyz * scale2) + bias2)\n  ) + (2.0 * \n    ((texture (sampler_blur2, fract(uv3_2)).xyz * scale2) + bias2)\n  )));\n  crisp_1 = ((3.0 * crisp_1) * rad);\n  float tmpvar_9;\n  tmpvar_9 = clamp ((1.0 - (4.0 * rad)), 0.0, 1.0);\n  vec4 tmpvar_10;\n  tmpvar_10.w = 1.0;\n  tmpvar_10.xyz = ((crisp_1 + (\n    ((vec3(0.0, 0.0, 1.0) * uv.y) * pow ((1.0 - rad), 8.0))\n   * tmpvar_9)) + (tmpvar_9 * texture (sampler_main, uv).xyz));\n  ret = tmpvar_10.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":5,"additive":1,"x":0.9,"rad":0.22613,"g":0.6,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.05+div(randint(900),1E3);a.y=.05+div(randint(900),1E3);a.ang=div(randint(320),100);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index2=0;a.q25=0;a.index=0;a.q22=0;a.q21=0;a.q29=0;a.q1=0;a.dec_med=0;a.index3=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q4=0;a.q26=0;a.p2=0;a.avg=0;a.beat=0;a.p1=0;a.dx1=0;a.peak=0;a.q2=0;a.q27=0;a.p3=0;a.q3=0;a.t0=0;a.rot1=0;a.q28=0;a.q20=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.96,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.5+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,4);a.index2=mod(a.index2+a.is_beat*bnot(a.index),8);a.index3=mod(a.index3+a.is_beat*bnot(a.index)*bnot(a.index2),3);a.q20=a.avg;a.q21=
a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass+a.mid+a.treb;a.k1=a.is_beat*equal(a.index,0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.p3=a.dec_med*a.p3+(1-a.dec_med)*a.p2;a.rott=div(3.1416*a.p3,2);a.rot1+=a.q26;a.q25=.01*a.rot1;a.q27=8-a.index;a.q28=a.index3;a.dx1=a.dec_med*a.dx1+(1-a.dec_med)*bnot(a.index2);a.q29=a.dx1;a.monitor=a.q29;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;
return a;},pixel_eqs:function(a){
a.rot=0;a.dx=.02*a.q29;a.zoom=1;
return a;}}),
"$$$ Royal - Mashup (197)":()=>Object.assign({"baseVals":{"rating":3,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"wrap":0,"darken_center":1,"solarize":1,"wave_a":0.001,"zoom":0.97,"rot":-6.27999,"warp":0.00052,"wave_r":0,"wave_g":0,"wave_b":0,"ob_r":1,"ob_g":1,"ob_b":1,"mv_r":0.8,"mv_a":0},"warp":" shader_body { \n  vec3 ret_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = (vec2(1.0, 0.0) * texsize.z);\n  vec2 tmpvar_3;\n  tmpvar_3 = (vec2(0.0, 1.0) * texsize.z);\n  ret_1 = (((\n    (texture (sampler_main, (uv + tmpvar_2)).xyz + texture (sampler_main, (uv + tmpvar_2)).xyz)\n   * 0.5) + (\n    (texture (sampler_main, (uv + tmpvar_3)).xyz + texture (sampler_main, (uv + tmpvar_3)).xyz)\n   * 0.5)) - texture (sampler_main, ((\n    (uv - 0.5)\n   * 0.9) + 0.5)).xyz);\n  ret_1 = (ret_1 - 0.4);\n  vec4 tmpvar_4;\n  tmpvar_4.w = 1.0;\n  tmpvar_4.xyz = ret_1;\n  ret = tmpvar_4.xyz;\n }","comp":" shader_body { \n  vec3 ret_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = ((0.5 - uv) + 0.5);\n  ret_1 = (mix (texture (sampler_main, uv).xyz, texture (sampler_main, tmpvar_2).xyz, vec3(0.5, 0.5, 0.5)) * 2.0);\n  ret_1 = (((\n    ((texture (sampler_blur3, uv).xyz * scale3) + bias3)\n   * 2.0) + (\n    ((texture (sampler_blur3, tmpvar_2).xyz * scale3) + bias3)\n   * 2.0)) + ret_1);\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = ret_1;\n  ret = tmpvar_3.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"textured":1,"x":0.25,"y":0.75,"rad":4.44708,"tex_zoom":0.22746,"r":0,"a":0.1,"g2":0,"a2":0.2,"border_r":0,"border_g":0,"border_a":0}},{init_eqs:function(a){
a.q1=0;a.tex_capture=0;a.q3=0;a.tex_saw=.4;
return a;},frame_eqs:function(a){
a.ang=.2*a.q1;a.tex_capture=above(a.q3,1);a.tex_zoom=.6;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"thick":1,"smoothing":0}},{init_eqs:function(a){
a.q1=0;a.speed=0;a.v=0;a.xs=0;a.ys=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.q1=0;a.speed=.8*a.bass_att;a.v=1E6*a.sample+a.value2*a.bass*.1;a.xs+=Math.sin(a.v)*a.speed*Math.atan(1.51*a.v);a.ys+=Math.sin(a.v)*a.speed*Math.atan(10*a.v);a.x=.5+.5*Math.sin(.1*a.xs)*Math.cos(.2*a.time+a.xs);a.y=.5+.5*Math.sin(.12*a.ys)*Math.cos(.1*a.time+a.xs);a.x=.8*a.x+.1;a.y=.8*a.y+.1;a.r=.5*Math.sin(1.22*a.time)+.6;a.g=.4+.4*Math.sin(1.307*a.time+2*a.y);a.b=.4+.4*Math.sin(1.959*a.time+2*a.x);a.xs=.00001<Math.abs(above(a.xs,1E3))?0:a.xs;a.ys=.00001<Math.abs(above(a.ys,
1E3))?0:a.ys;
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"smoothing":0}},{init_eqs:function(a){
a.q1=0;a.speed=0;a.v=0;a.xs=0;a.ys=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.q1=0;a.speed=.8*a.bass_att;a.v=1E6*a.sample+a.value2*a.bass*.1;a.xs+=Math.sin(a.v)*a.speed*Math.atan(1.51*a.v);a.ys+=Math.sin(a.v)*a.speed*Math.atan(10*a.v);a.x=.5+.5*Math.sin(.1*a.xs)*Math.cos(.2*a.time+a.xs);a.y=.5+.5*Math.sin(.14*a.ys)*Math.cos(.1*a.time+a.xs);a.x=.8*a.x+.1;a.y=.8*a.y+.1;a.x=.6*a.x+.2;a.y=.6*a.y+.2;a.r=.5*Math.sin(1.322*a.time)+.6;a.g=.4+.4*Math.sin(1.5407*a.time+2*a.y);a.b=.4+.4*Math.sin(1.759*a.time+2*a.x);a.xs=.00001<Math.abs(above(a.xs,1E3))?0:a.xs;
a.ys=.00001<Math.abs(above(a.ys,1E3))?0:a.ys;
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"smoothing":0}},{init_eqs:function(a){
a.q1=0;a.speed=0;a.v=0;a.xs=0;a.ys=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.q1=0;a.speed=.8*a.bass_att;a.v=1E6*a.sample+a.value2*a.bass*.1;a.xs+=Math.sin(a.v)*a.speed*Math.atan(1.51*a.v);a.ys+=Math.sin(a.v)*a.speed*Math.atan(10*a.v);a.x=.5+.5*Math.sin(.1*a.xs)*Math.cos(.2*a.time+a.xs);a.y=.5+.5*Math.sin(.14*a.ys)*Math.cos(.1*a.time+a.xs);a.x=.8*a.x+.1;a.y=.8*a.y+.1;a.x=.25*a.x+.375;a.y=.25*a.y+.375;a.r=.5*Math.sin(1.622*a.time)+.6;a.g=.4+.4*Math.sin(1.2407*a.time+2*a.y);a.b=.4+.4*Math.sin(1.359*a.time+2*a.x);a.xs=.00001<Math.abs(above(a.xs,1E3))?
0:a.xs;a.ys=.00001<Math.abs(above(a.ys,1E3))?0:a.ys;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.basstime=0;a.stickybit=0;a.volavg2=0;a.q1=0;a.decay_r=0;a.sample1=0;a.difftime=0;a.diff=0;a.decay_b=0;a.edge=0;a.volavg=0;a.bit2=0;a.vol=0;a.q2=0;a.q3=0;a.basssum=0;a.decay_g=0;a.sample2=0;
return a;},frame_eqs:function(a){
a.basstime+=.03*a.bass;a.q1=4*a.basstime;a.basstime=.00001<Math.abs(below(a.basstime,1E3))?1E3:a.basstime;a.basstime+=.03*a.bass_att;a.vol=pow(a.bass+a.mid+a.treb,2);a.basssum=a.vol;a.stickybit=mod(a.time,2);a.volavg+=a.vol*equal(a.stickybit,1);a.sample1+=equal(a.stickybit,1);a.volavg2+=a.vol*equal(a.stickybit,0);a.sample2+=equal(a.stickybit,0);a.edge=bnot(equal(a.bit2,a.stickybit));a.volavg-=a.volavg*a.edge*a.stickybit;a.volavg2-=a.volavg2*a.edge*equal(a.stickybit,0);a.sample1-=
a.sample1*a.edge*a.stickybit;a.sample2-=a.sample2*a.edge*equal(a.stickybit,0);a.diff=.00001<Math.abs(equal(a.stickybit,1))?div(a.basssum,div(a.volavg2,a.sample2)):0;a.diff=.00001<Math.abs(equal(a.stickybit,0))?div(a.basssum,div(a.volavg,a.sample1)):a.diff;a.q3=a.diff;a.bit2=mod(a.time,2);a.difftime+=.03*a.diff;a.q2=a.difftime;a.difftime=.00001<Math.abs(above(a.difftime,2E3))?0:a.difftime;a.monitor=3.14*Math.abs(Math.cos(a.time));a.mv_a=above(a.diff,10);
return a;},pixel_eqs:function(a){
a.zoom=1+.05*a.q3*a.rad;a.decay_r=.2*a.rad*Math.sin(.35*a.q2)+.85+.1*Math.sin(a.q2);a.decay_g=.2*a.rad*Math.sin(.5*a.q2)+.85+.1*Math.sin(.7*a.q2);a.decay_b=.2*a.rad*Math.sin(.4*a.q2)+.85+.1*Math.sin(.8*a.q2);a.rot=0;
return a;}}),
"_Eo.S. - glowsticks v2 02 - Geiss HPF":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1,"decay":0.96,"echo_zoom":1.007,"echo_orient":1,"wave_mode":2,"wave_dots":1,"wave_brighten":0,"wrap":0,"darken":1,"wave_a":0.001,"wave_scale":0.012,"wave_smoothing":0.9,"warpanimspeed":0.037,"warpscale":0.015,"warp":0.033,"wave_r":0.5,"wave_g":0.4,"wave_b":0.3,"ob_size":0,"ob_r":0.11,"ob_b":0.1,"ib_size":0,"ib_r":0,"ib_g":0,"ib_b":0,"mv_x":3,"mv_y":2,"mv_dx":0.02,"mv_dy":-0.02,"mv_l":0.15,"mv_r":0.49,"mv_g":0.48,"mv_b":0.3,"mv_a":0},"pixel_eqs":"","warp":" shader_body { \n  vec3 ret_1;\n  ret_1 = (mix (texture (sampler_fc_main, uv).xyz, (\n    (texture (sampler_blur1, uv).xyz * scale1)\n   + bias1), vec3(-0.25, -0.25, -0.25)) * 0.93);\n  ret_1 = (ret_1 * 0.96);\n  vec4 tmpvar_2;\n  tmpvar_2.w = 1.0;\n  tmpvar_2.xyz = ret_1;\n  ret = tmpvar_2.xyz;\n }","comp":" shader_body { \n  vec3 ret_1;\n  ret_1 = texture (sampler_main, uv).xyz;\n  ret_1 = (ret_1 * ret_1);\n  vec4 tmpvar_2;\n  tmpvar_2.w = 1.0;\n  tmpvar_2.xyz = ret_1;\n  ret = tmpvar_2.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":5,"textured":1,"rad":1.06779,"ang":0.75398,"tex_zoom":0.77977,"g":1,"b":1,"r2":1,"b2":1,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"thick":1,"r":0.1,"b":0.7}},{init_eqs:function(a){
a.n=0;a.yq=0;a.xp=0;a.xs=0;a.yp=0;a.q1=0;a.xq=0;a.flip=0;a.ys=0;a.zq=0;a.phs=0;a.ang=0;a.tm=0;a.zp=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.n=6.283*a.sample;a.phs=.2*-a.sample;a.tm=a.q1+a.phs;a.flip+=1;a.flip*=below(a.flip,2);a.xp=0;a.yp=.1*a.flip+.2*(.5*Math.sin(a.tm)+.5);a.zp=0;a.ang=.5*Math.sin(2*a.tm)+.5;a.xq=a.xp;a.yq=a.yp*Math.sin(a.ang)+a.zp*Math.cos(a.ang);a.zq=a.yp*Math.cos(a.ang)-a.zp*Math.sin(a.ang);a.yq=a.yp;a.zq=a.zp;a.ang=8*a.tm;a.xp=a.xq*Math.sin(a.ang)+a.yq*Math.cos(a.ang);a.yp=a.xq*Math.cos(a.ang)-a.yq*Math.sin(a.ang);a.zp=a.zq;a.zp-=.3;a.ang=3.14+1.5*Math.sin(2*a.tm-.5);a.xq=a.xp;a.yq=a.yp*Math.sin(a.ang)+
a.zp*Math.cos(a.ang);a.zq=a.yp*Math.cos(a.ang)-a.zp*Math.sin(a.ang);a.ang=-1+Math.cos(3*a.tm+.5);a.xp=a.xq*Math.sin(a.ang)+a.yq*Math.cos(a.ang);a.yp=a.xq*Math.cos(a.ang)-a.yq*Math.sin(a.ang);a.zp=a.zq;a.zp-=.35;a.ang=.75*Math.cos(2*a.tm)-1.05;a.xq=a.xp*Math.sin(a.ang)+a.zp*Math.cos(a.ang);a.yq=a.yp;a.zq=a.xp*Math.cos(a.ang)-a.zp*Math.sin(a.ang);a.ang=.5*Math.cos(a.tm)-.5;a.xp=a.xq;a.yp=a.yq*Math.cos(a.ang)-a.zq*Math.sin(a.ang);a.zp=a.yq*Math.sin(a.ang)+a.zq*Math.cos(a.ang);a.zp+=2;a.xs=div(a.xp,a.zp);
a.ys=div(a.yp,a.zp);a.x=a.xs+.5;a.y=1.3*a.ys+.5;a.a=(1-a.sample)*a.flip;a.b+=.3*pow(1-a.sample,2);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"r":0.2,"b":0.6}},{init_eqs:function(a){
a.n=0;a.yq=0;a.xp=0;a.xs=0;a.yp=0;a.q1=0;a.xq=0;a.flip=0;a.ys=0;a.zq=0;a.phs=0;a.ang=0;a.tm=0;a.zp=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.n=6.283*a.sample;a.phs=.2*-a.sample;a.tm=a.q1+a.phs;a.flip+=1;a.flip*=below(a.flip,2);a.xp=0;a.yp=.1*a.flip+.2*(.5*Math.sin(a.tm)+.5);a.yp=-a.yp;a.zp=0;a.ang=.5*Math.sin(2*a.tm)+.5;a.xq=a.xp;a.yq=a.yp*Math.sin(a.ang)+a.zp*Math.cos(a.ang);a.zq=a.yp*Math.cos(a.ang)-a.zp*Math.sin(a.ang);a.yq=a.yp;a.zq=a.zp;a.ang=8*a.tm;a.xp=a.xq*Math.sin(a.ang)+a.yq*Math.cos(a.ang);a.yp=a.xq*Math.cos(a.ang)-a.yq*Math.sin(a.ang);a.zp=a.zq;a.zp-=.3;a.ang=3.14+1.5*Math.sin(2*a.tm-.5);a.xq=a.xp;
a.yq=a.yp*Math.sin(a.ang)+a.zp*Math.cos(a.ang);a.zq=a.yp*Math.cos(a.ang)-a.zp*Math.sin(a.ang);a.ang=-1+Math.cos(3*a.tm+.5);a.xp=a.xq*Math.sin(a.ang)+a.yq*Math.cos(a.ang);a.yp=a.xq*Math.cos(a.ang)-a.yq*Math.sin(a.ang);a.zp=a.zq;a.zp-=.35;a.ang=.75*Math.cos(2*a.tm)-1.05;a.xq=a.xp*Math.sin(a.ang)+a.zp*Math.cos(a.ang);a.yq=a.yp;a.zq=a.xp*Math.cos(a.ang)-a.zp*Math.sin(a.ang);a.ang=.5*Math.cos(a.tm)-.5;a.xp=a.xq;a.yp=a.yq*Math.cos(a.ang)-a.zq*Math.sin(a.ang);a.zp=a.yq*Math.sin(a.ang)+a.zq*Math.cos(a.ang);
a.zp+=2;a.xs=div(a.xp,a.zp);a.ys=div(a.yp,a.zp);a.x=a.xs+.5;a.y=1.3*a.ys+.5;a.a=(1-a.sample)*a.flip;a.b+=.3*pow(1-a.sample,2);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.q1=0;a.mv_x=64;a.mv_y=48;a.nut=0;a.stp=0;a.stq=0;a.rtp=0;a.rtq=0;a.wvr=0;a.decay=0;a.dcsp=0;
return a;},frame_eqs:function(a){
a.decay=.98;a.zoom=1.002;a.q1=.9*a.time;
return a;},pixel_eqs:''}),
"_geiss_experimental__wavefronts":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1.14,"decay":1,"echo_zoom":1.002,"echo_orient":1,"wave_mode":6,"wave_thick":1,"wave_a":1.577,"wave_scale":1.031,"wave_smoothing":0,"modwavealphastart":0.5,"modwavealphaend":1,"warpanimspeed":32.544,"warpscale":9.738,"dx":-0.005,"warp":0.01,"wave_r":0.5,"wave_g":0.5,"wave_b":0.5,"wave_x":0,"wave_y":1,"ob_size":0.005,"ob_r":0.01,"ob_a":0.6,"ib_size":0.26,"mv_x":16,"mv_y":16.8,"mv_l":0.15,"mv_g":0,"mv_b":0,"mv_a":0},"pixel_eqs":"","warp":" shader_body { \n  vec4 tmpvar_1;\n  tmpvar_1.w = 1.0;\n  tmpvar_1.xyz = (texture (sampler_main, (uv + (\n    (texture (sampler_main, (uv + texsize.zw)).xy - 0.37)\n   * 0.03))).xyz - 0.004);\n  ret = tmpvar_1.xyz;\n }","comp":" shader_body { \n  vec2 uv2_1;\n  vec3 ret_2;\n  uv2_1 = (uv + (vec2(1.0, 0.0) * texsize.zw));\n  float tmpvar_3;\n  tmpvar_3 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(-1.0, 0.0) * texsize.zw));\n  float tmpvar_4;\n  tmpvar_4 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, 1.0) * texsize.zw));\n  float tmpvar_5;\n  tmpvar_5 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, -1.0) * texsize.zw));\n  vec3 tmpvar_6;\n  tmpvar_6.z = 0.14;\n  tmpvar_6.x = (tmpvar_3 - tmpvar_4);\n  tmpvar_6.y = (tmpvar_5 - ((\n    (texture (sampler_main, uv2_1).xyz + (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4))\n   + \n    (((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2) * 0.15)\n  ) + (\n    ((texture (sampler_blur3, uv2_1).xyz * scale3) + bias3)\n   * 0.1)).x);\n  ret_2 = (0.5 + (0.5 * normalize(tmpvar_6)));\n  vec2 x_7;\n  x_7 = (ret_2.xy - 0.5);\n  ret_2 = (ret_2 * clamp ((\n    sqrt(dot (x_7, x_7))\n   * 5.0), 0.0, 1.0));\n  ret_2 = ret_2.xxy;\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_2;\n  ret = tmpvar_8.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.red_rand=0;a.blue_rand=0;
return a;},frame_eqs:function(a){
a.dy-=.0085;a.red_rand=randint(100);a.blue_rand=randint(100);a.wave_r=.01*a.red_rand+.2*Math.sin(1.311*a.time);a.wave_b=.01*a.blue_rand-.2*Math.sin(1.46*a.time);a.wave_g=1-.5*(a.wave_r+a.wave_b)+.2*Math.cos(.789*a.time);
return a;},pixel_eqs:''}),
"_Mig_056":()=>Object.assign({"baseVals":{"rating":5,"decay":1,"wave_mode":3,"wave_thick":1,"wave_brighten":0,"wave_a":11.94,"wave_scale":0.387,"wave_smoothing":0.7,"warpscale":1.772,"zoomexp":4.401,"zoom":1.031,"rot":0.003,"warp":0,"wave_r":0.49,"wave_g":0.49,"wave_b":0.49,"mv_a":0},"pixel_eqs":"","warp":" shader_body { \n  vec3 ret_1;\n  ret_1 = (texture (sampler_main, uv).xyz + ((\n    (texture (sampler_noise_lq, (((uv_orig * texsize.xy) * texsize_noise_lq.zw) + rand_frame.xy)).xxx - 0.5)\n   / 256.0) * 2.0));\n  vec2 x_2;\n  x_2 = (uv - uv_orig);\n  ret_1 = (ret_1 * (0.97 + (0.03 * \n    clamp ((sqrt(dot (x_2, x_2)) * 200.0), 0.0, 1.0)\n  )));\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = ret_1;\n  ret = tmpvar_3.xyz;\n }","comp":" shader_body { \n  vec4 tmpvar_1;\n  tmpvar_1.w = 1.0;\n  tmpvar_1.xyz = (((\n    (texture (sampler_main, uv).xyz * -2.0)\n   + \n    (((texture (sampler_blur1, uv).xyz * scale1) + bias1) * 2.0)\n  ) + (\n    ((texture (sampler_blur2, uv).xyz * scale2) + bias2)\n   * 2.0)) - 0.7);\n  ret = tmpvar_1.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.t=0;
return a;},frame_eqs:function(a){
a.t=2.3*a.time;a.wave_x+=.35*(.7*Math.sin(2.221*a.time)+.3*Math.sin(1.821*a.time));a.wave_y+=.35*(.3*Math.sin(1.942*a.time)+.7*Math.sin(2.522*a.time));a.wave_r+=.79*(.6*Math.sin(.823*a.t)+.4*Math.sin(.916*a.t));a.wave_g+=.79*(.6*Math.sin(.9*a.t)+.4*Math.sin(1.023*a.t));a.wave_b+=.79*(.6*Math.sin(.808*a.t)+.4*Math.sin(.949*a.t));a.rot+=.01*(.6*Math.sin(.038*a.time)+.4*Math.sin(.054*a.time));a.dx+=.002*(.6*Math.sin(.434*a.time)+.4*Math.sin(.277*a.time));a.dy+=.002*(.6*Math.sin(.384*
a.time)+.4*Math.sin(.477*a.time));
return a;},pixel_eqs:''}),
"_Mig_085":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1.7,"echo_zoom":1.16936,"wave_mode":2,"wave_dots":1,"wave_brighten":0,"wave_a":0.001,"wave_scale":0.011726,"wave_smoothing":0.9,"zoom":0.999902,"warp":0.01,"wave_r":0.5,"wave_g":0.4,"wave_b":0.3,"ob_size":0.0065,"ib_size":0.26,"mv_x":0,"mv_y":43.199997,"mv_l":1,"mv_g":0.91,"mv_b":0.71,"mv_a":0},"pixel_eqs":"","warp":" shader_body { \n  vec3 ret_1;\n  ret_1 = texture (sampler_main, uv).xyz;\n  vec2 tmpvar_2;\n  tmpvar_2 = (normalize((uv - uv_orig)) * texsize.zw);\n  vec4 tmpvar_3;\n  tmpvar_3.w = 0.0;\n  tmpvar_3.xyz = ret_1;\n  vec4 tmpvar_4;\n  tmpvar_4.w = 0.0;\n  tmpvar_4.xyz = max (tmpvar_3, (texture (sampler_main, (uv - tmpvar_2)) * 0.9)).xyz;\n  vec4 tmpvar_5;\n  tmpvar_5.w = 0.0;\n  tmpvar_5.xyz = max (tmpvar_4, (texture (sampler_main, (uv + tmpvar_2)) * 0.97)).xyz;\n  vec4 tmpvar_6;\n  tmpvar_6.w = 0.0;\n  tmpvar_6.xyz = max (tmpvar_5, (texture (sampler_main, (uv + \n    (tmpvar_2 * 2.0)\n  )) * 0.97)).xyz;\n  ret_1 = (max (tmpvar_6, (texture (sampler_main, \n    (uv + (tmpvar_2 * 3.0))\n  ) * 0.9)).xyz * 0.92);\n  vec4 tmpvar_7;\n  tmpvar_7.w = 1.0;\n  tmpvar_7.xyz = ret_1;\n  ret = tmpvar_7.xyz;\n }","comp":" shader_body { \n  vec2 uv_1;\n  vec3 ret_2;\n  uv_1 = (0.05 + (0.9 * uv));\n  ret_2 = (abs((\n    ((texture (sampler_blur1, uv_1).xyz * scale1) + bias1)\n   - texture (sampler_main, uv_1).xyz)) * 6.0);\n  ret_2 = (ret_2 * 1.333);\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = ret_2;\n  ret = tmpvar_3.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"r":0.1,"b":0.7}},{init_eqs:function(a){
a.n=0;a.yq=0;a.xp=0;a.t5=0;a.xs=0;a.yp=0;a.t1=0;a.q1=0;a.cosang=0;a.r1=0;a.g2=0;a.xq=0;a.t3=0;a.flip=0;a.t6=0;a.ys=0;a.zq=0;a.phs=0;a.r2=0;a.ang=0;a.sinang=0;a.tm=0;a.b2=0;a.t2=0;a.zp=0;a.g1=0;a.t4=0;a.b1=0;a.q8=0;
return a;},frame_eqs:function(a){
a.t1=.5*Math.sin(a.time)+.5;a.t2=.5*Math.sin(a.time+2.1)+.5;a.t3=.5*Math.sin(a.time+4.2)+.5;a.t4=.5*Math.sin(a.time+1.1)+.5;a.t5=.5*Math.sin(a.time+3.1)+.5;a.t6=.5*Math.sin(a.time+5.2)+.5;
return a;},point_eqs:function(a){
a.n=6.283*a.sample;a.phs=.2*-a.sample;a.tm=a.q1+a.phs;a.flip+=1;a.flip*=below(a.flip,2);a.xp=0;a.yp=.1*a.flip+.2*(.5*Math.sin(a.tm)+.5);a.zp=0;a.ang=.5*Math.sin(2*a.tm)+.5;a.xq=a.xp;a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.yq=a.yp*a.sinang+a.zp*a.cosang;a.zq=a.yp*a.cosang-a.zp*a.sinang;a.yq=a.yp;a.zq=a.zp;a.ang=8*a.tm;a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xp=a.xq*a.sinang+a.yq*a.cosang;a.yp=a.xq*a.cosang-a.yq*a.sinang;a.zp=a.zq;a.zp-=.3;a.ang=3.14+1.5*
Math.sin(2*a.tm-.5);a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xq=a.xp;a.yq=a.yp*a.sinang+a.zp*a.cosang;a.zq=a.yp*a.cosang-a.zp*a.sinang;a.ang=-1+Math.cos(3.1*a.tm+.5);a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xp=a.xq*a.sinang+a.yq*a.cosang;a.yp=a.xq*a.cosang-a.yq*a.sinang;a.zp=a.zq;a.zp-=.35;a.ang=1.75*Math.cos(2.3*a.tm)-1.05;a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xq=a.xp*a.sinang+a.zp*a.cosang;a.yq=a.yp;a.zq=a.xp*a.cosang-a.zp*a.sinang;a.ang=.5*Math.cos(a.tm)-.5;
a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xp=a.xq;a.yp=a.yq*a.cosang-a.zq*a.sinang;a.zp=a.yq*a.sinang+a.zq*a.cosang;a.zp+=2;a.xs=div(a.xp,a.zp);a.ys=div(a.yp,a.zp);a.x=a.xs+.5;a.y=1.3*a.ys+.5;a.a=.00001<Math.abs(equal(a.q8,1))?1-a.sample:a.sample;a.a*=a.a;a.b+=.3*pow(1-a.sample,2);a.r1=a.t1;a.g1=a.t2;a.b1=a.t3;a.r2=a.t4;a.g2=a.t5;a.b2=a.t6;a.r=a.r1*a.flip+a.r2*(1-a.flip);a.g=a.g1*a.flip+a.g2*(1-a.flip);a.b=a.b1*a.flip+a.b2*(1-a.flip);
return a;}}),Object.assign({"baseVals":{"enabled":1,"r":0.2,"b":0.6}},{init_eqs:function(a){
a.n=0;a.yq=0;a.xp=0;a.t5=0;a.xs=0;a.yp=0;a.t1=0;a.q1=0;a.cosang=0;a.r1=0;a.g2=0;a.xq=0;a.t3=0;a.flip=0;a.t6=0;a.ys=0;a.zq=0;a.phs=0;a.r2=0;a.ang=0;a.sinang=0;a.tm=0;a.b2=0;a.t2=0;a.zp=0;a.g1=0;a.t4=0;a.b1=0;a.q8=0;
return a;},frame_eqs:function(a){
a.t1=.5*Math.sin(a.time)+.5;a.t2=.5*Math.sin(a.time+2.1)+.5;a.t3=.5*Math.sin(a.time+4.2)+.5;a.t4=.5*Math.sin(a.time+1.1)+.5;a.t5=.5*Math.sin(a.time+3.1)+.5;a.t6=.5*Math.sin(a.time+5.2)+.5;
return a;},point_eqs:function(a){
a.n=6.283*a.sample;a.phs=.2*-a.sample;a.tm=a.q1+a.phs;a.flip+=1;a.flip*=below(a.flip,2);a.xp=0;a.yp=.1*a.flip+.2*(.5*Math.sin(a.tm)+.5)+.1;a.yp=-a.yp;a.zp=0;a.ang=.5*Math.sin(2*a.tm)+.5;a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xq=a.xp;a.yq=a.yp*a.sinang+a.zp*a.cosang;a.zq=a.yp*a.cosang-a.zp*a.sinang;a.yq=a.yp;a.zq=a.zp;a.ang=8*a.tm;a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xp=a.xq*a.sinang+a.yq*a.cosang;a.yp=a.xq*a.cosang-a.yq*a.sinang;a.zp=a.zq;a.zp-=.3;
a.ang=3.14+1.5*Math.sin(2*a.tm-.5);a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xq=a.xp;a.yq=a.yp*a.sinang+a.zp*a.cosang;a.zq=a.yp*a.cosang-a.zp*a.sinang;a.ang=-1+Math.cos(3.1*a.tm+.5);a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xp=a.xq*a.sinang+a.yq*a.cosang;a.yp=a.xq*a.cosang-a.yq*a.sinang;a.zp=a.zq;a.zp-=.35;a.ang=1.75*Math.cos(2.3*a.tm)-1.05;a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xq=a.xp*a.sinang+a.zp*a.cosang;a.yq=a.yp;a.zq=a.xp*a.cosang-a.zp*a.sinang;a.ang=.5*Math.cos(a.tm)-
.5;a.sinang=Math.sin(a.ang);a.cosang=Math.cos(a.ang);a.xp=a.xq;a.yp=a.yq*a.cosang-a.zq*a.sinang;a.zp=a.yq*a.sinang+a.zq*a.cosang;a.zp+=2;a.xs=div(a.xp,a.zp);a.ys=div(a.yp,a.zp);a.x=a.xs+.5;a.y=1.3*a.ys+.5;a.a=.00001<Math.abs(equal(a.q8,1))?1-a.sample:a.sample;a.a*=a.a;a.b+=.3*pow(1-a.sample,2);a.r1=a.t1;a.g1=a.t2;a.b1=a.t3;a.r2=a.t4;a.g2=a.t5;a.b2=a.t6;a.r=a.r1*a.flip+a.r2*(1-a.flip);a.g=a.g1*a.flip+a.g2*(1-a.flip);a.b=a.b1*a.flip+a.b2*(1-a.flip);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.movement=0;a.q1=0;
return a;},frame_eqs:function(a){
a.movement=a.movement+.01*(a.bass+a.bass_att)+.001*pow(a.bass+1,3);a.q1=a.movement;a.monitor=a.q1;
return a;},pixel_eqs:''}),
"Adam Eatit Mashup FX 2 martin - disco mix + Lodus + Geiss + Ludicrous speed + Aderrasi 2_1":()=>Object.assign({"baseVals":{"rating":3,"gammaadj":1.78,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"wave_mode":6,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken":1,"wave_a":0.312,"wave_scale":1.229,"wave_smoothing":0,"wave_mystery":0.2,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":2.853,"zoom":1.064,"warp":0,"wave_r":0,"wave_g":0,"wave_b":0,"mv_x":64,"mv_y":48,"mv_l":0,"mv_b":0.5,"mv_a":0,"b1x":0.7,"b1ed":0},"warp":" shader_body { \n  vec2 uv_1;\n  vec2 uv6_2;\n  uv_1 = (uv + (vec2(0.0, 0.01) * dot (\n    ((texture (sampler_blur1, uv).xyz * scale1) + bias1)\n  , vec3(0.32, 0.49, 0.29))));\n  uv6_2 = (0.4 * sin((\n    (uv_1 * 8.0)\n   + \n    (rand_frame * 6.0)\n  .xy)));\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = (((\n    (texture (sampler_main, uv_1).xyz - (((texture (sampler_blur2, \n      fract(uv_1)\n    ).xyz * scale2) + bias2) * 0.03))\n   + \n    (0.1 * (vec3((0.1 / sqrt(\n      dot (uv6_2, uv6_2)\n    ))) * ((1.0 + roam_cos) / 2.0).xyz))\n  ) * 0.99) - 0.02);\n  ret = tmpvar_3.xyz;\n }","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":100,"textured":1,"rad":0.14392,"tex_zoom":4.57482,"g":1,"b":1,"a":0.9,"r2":0.84,"g2":0.93,"b2":1,"border_r":0.8,"border_g":0,"border_a":0.4}},{init_eqs:function(a){
a.q24=0;
return a;},frame_eqs:function(a){
a.textured=bnot(a.q24);a.rad=.2*Math.max(Math.sin(div(a.time,9))-.6,0);a.x=.5+.01*Math.sin(div(a.time,2));a.border_r=.4*(1.5+Math.sin(div(a.time,18)));a.border_g=.4*(1.5+Math.sin(div(a.time,38)));a.border_b=.4*(1.5+Math.sin(div(a.time,28)));
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":63,"additive":1,"rad":1.99863,"tex_zoom":0.49981,"g":1,"b":1,"a":0.1,"r2":1,"b2":1,"a2":0.6,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){
a.trel=0;a.q20=0;a.q28=0;a.q26=0;
return a;},frame_eqs:function(a){
a.trel=div(a.time,2)+a.q20;a.x=.5+Math.sin(a.trel);a.y=.5+Math.cos(1.3*a.trel+div(a.q28,3));a.rad=.03;a.a=div(a.q26,4)+.2;a.a2=0;a.a=1;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"scaling":0.89152,"smoothing":0.82,"a":0.6}},{init_eqs:function(a){
a.xang=0;a.ampl=0;a.fov=0;a.winkel=0;a.t1=0;a.yang=0;a.t3=0;a.vol_m=0;a.my=0;a.oz=0;a.t_rel=0;a.pulse=0;a.exc=0;a.mz=0;a.q26=0;a.oy=0;a.mx=0;a.t2=0;a.vol=0;a.zang=0;a.monitor=0;a.t_abs=0;a.ox=0;
return a;},frame_eqs:function(a){
a.t1=Math.cos(div(a.time,3));a.t2=Math.sin(div(a.time,7));a.vol=a.mid_att+a.treb_att;a.vol_m=.999*a.vol_m+.001*a.vol;a.exc=above(a.vol,1.1*a.vol_m);a.pulse=.95*a.pulse+.05*a.exc;a.winkel+=div(a.pulse,3);a.t3=a.winkel;
return a;},point_eqs:function(a){
a.t_abs=a.sample;a.t_rel=a.sample-div(a.time,6);a.ampl=Math.sin(3*a.t_abs);a.ox=3*Math.sin(a.time)+a.ampl*Math.sin(267*a.t_rel);a.oy=3*Math.cos(a.time)+a.ampl*Math.cos(277*a.t_rel);a.oz=0*Math.cos(div(a.t_rel*a.time,23))+4*a.t_abs;a.r=sqr(Math.sin(3.4*a.t_rel));a.g=sqr(Math.sin(2.3*a.t_rel));a.b=sqr(Math.cos(.9*a.t_rel));a.a=.2*Math.cos(1*a.t_abs)+div(a.q26,16);a.xang=a.t2+div(a.t3,3);a.yang=a.t1*a.t2-div(a.t3,4);a.zang=a.t3;a.fov=.2;a.monitor=a.t2;a.mx=a.ox*Math.cos(a.zang)-
a.oy*Math.sin(a.zang);a.my=a.ox*Math.sin(a.zang)+a.oy*Math.cos(a.zang);a.ox=a.mx;a.oy=a.my;a.mx=a.ox*Math.cos(a.yang)+a.oz*Math.sin(a.yang);a.mz=-a.ox*Math.sin(a.yang)+a.oz*Math.cos(a.yang);a.ox=a.mx;a.oz=a.mz;a.my=a.oy*Math.cos(a.xang)-a.oz*Math.sin(a.xang);a.mz=a.oy*Math.sin(a.xang)+a.oz*Math.cos(a.xang);a.oy=a.my;a.oz=a.mz;a.oz-=6;a.x=div(a.ox*a.fov,a.oz)+.5;a.y=div(a.oy*a.fov,a.oz)+.5;
return a;}}),Object.assign({"baseVals":{"enabled":1,"samples":232,"usedots":1,"additive":1,"scaling":0.89152,"smoothing":0.82,"a":0.1}},{init_eqs:function(a){
a.xang=0;a.ampl=0;a.fov=0;a.t1=0;a.yang=0;a.my=0;a.oz=0;a.t_rel=0;a.mz=0;a.oy=0;a.mx=0;a.t2=0;a.zang=0;a.monitor=0;a.t_abs=0;a.ox=0;
return a;},frame_eqs:function(a){
a.t1=2*Math.sin(div(a.time,15));a.t2=2*Math.sin(div(a.time,11));a.monitor=a.time;
return a;},point_eqs:function(a){
a.t_abs=a.sample;a.t_rel=a.sample-div(a.time,5);a.ampl=a.time;a.ox=10*a.ampl*Math.sin(68*a.t_abs);a.oy=10*a.ampl*Math.cos(28*a.t_abs);a.oz=10*a.ampl*Math.cos(128*a.t_abs);a.r=Math.sin(1335*a.t_abs)+1;a.g=Math.sin(1783*a.t_abs)+1;a.b=div(randint(5),5);a.a=.5+.25*Math.sin(15*a.t_rel);a.xang=a.t1;a.yang=a.t1;a.zang=a.t1;a.fov=.12;a.mx=a.ox*Math.cos(a.zang)-a.oy*Math.sin(a.zang);a.my=a.ox*Math.sin(a.zang)+a.oy*Math.cos(a.zang);a.ox=a.mx;a.oy=a.my;a.mx=a.ox*Math.cos(a.yang)+a.oz*
Math.sin(a.yang);a.mz=-a.ox*Math.sin(a.yang)+a.oz*Math.cos(a.yang);a.ox=a.mx;a.oz=a.mz;a.my=a.oy*Math.cos(a.xang)-a.oz*Math.sin(a.xang);a.mz=a.oy*Math.sin(a.xang)+a.oz*Math.cos(a.xang);a.oy=a.my;a.oz=a.mz;a.oz-=6;a.x=div(a.ox*a.fov,a.oz)+.5;a.y=div(a.oy*a.fov,a.oz)+.5;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){

return a;},frame_eqs:function(a){
a.wave_r+=.1*(.6*Math.sin(.933*a.time)+.4*Math.sin(1.045*a.time));a.wave_g+=.1*(.6*Math.sin(.9*a.time)+.4*Math.sin(.956*a.time));a.wave_b+=.1*(.6*Math.sin(.91*a.time)+.4*Math.sin(.92*a.time));a.zoom+=.013*(.6*Math.sin(.339*a.time)+.4*Math.sin(.276*a.time));a.rot+=.04*(.6*Math.sin(.381*a.time)+.4*Math.sin(.579*a.time));
return a;},pixel_eqs:function(a){
a.rot=a.rot+.05+.04*Math.sin(3*a.ang+1.6*a.time);
return a;}}),
"Adam Eatit Mashup FX 2 martin - disco mix + Lodus + Geiss + Ludicrous speed + Baked Ft another AdamFX Mashup 7_1":()=>Object.assign({"baseVals":{"rating":4,"gammaadj":1.78,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"wave_mode":6,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken":1,"wave_a":0.312,"wave_scale":1.229,"wave_smoothing":0,"wave_mystery":0.2,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpanimspeed":5.996,"warpscale":1.331,"zoomexp":1.01,"zoom":0.99853,"rot":0.002,"warp":0.01,"wave_r":0,"wave_g":0,"wave_b":0,"ob_size":0,"ob_g":0.9,"ob_b":0.2,"ob_a":1,"ib_size":0,"ib_r":0.5,"ib_g":0.5,"ib_b":0.5,"ib_a":1,"mv_x":64,"mv_y":48,"mv_l":0,"mv_b":0.5,"mv_a":0,"b1x":0.7,"b1ed":0},"pixel_eqs":"","warp":" shader_body { \n  vec2 uv_1;\n  vec2 uv6_2;\n  uv_1 = (uv + (vec2(0.0, 0.01) * dot (\n    ((texture (sampler_blur1, uv).xyz * scale1) + bias1)\n  , vec3(0.32, 0.49, 0.29))));\n  uv6_2 = (0.4 * sin((\n    (uv_1 * 8.0)\n   + \n    (rand_frame * 6.0)\n  .xy)));\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = (((\n    (texture (sampler_main, uv_1).xyz - (((texture (sampler_blur2, \n      fract(uv_1)\n    ).xyz * scale2) + bias2) * 0.03))\n   + \n    (0.1 * (vec3((0.1 / sqrt(\n      dot (uv6_2, uv6_2)\n    ))) * ((1.0 + roam_cos) / 2.0).xyz))\n  ) * 0.99) - 0.02);\n  ret = tmpvar_3.xyz;\n }","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":100,"textured":1,"rad":0.14392,"tex_zoom":4.57482,"g":1,"b":1,"a":0.9,"r2":0.84,"g2":0.93,"b2":1,"border_r":0.8,"border_g":0,"border_a":0.4}},{init_eqs:function(a){
a.q24=0;
return a;},frame_eqs:function(a){
a.textured=bnot(a.q24);a.rad=.2*Math.max(Math.sin(div(a.time,9))-.6,0);a.x=.5+.01*Math.sin(div(a.time,2));a.border_r=.4*(1.5+Math.sin(div(a.time,18)));a.border_g=.4*(1.5+Math.sin(div(a.time,38)));a.border_b=.4*(1.5+Math.sin(div(a.time,28)));
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":63,"additive":1,"rad":1.99863,"tex_zoom":0.49981,"g":1,"b":1,"a":0.1,"r2":1,"b2":1,"a2":0.6,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){
a.trel=0;a.q20=0;a.q28=0;a.q26=0;
return a;},frame_eqs:function(a){
a.trel=div(a.time,2)+a.q20;a.x=.5+Math.sin(a.trel);a.y=.5+Math.cos(1.3*a.trel+div(a.q28,3));a.rad=.03;a.a=div(a.q26,4)+.2;a.a2=0;a.a=1;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"scaling":0.89152,"smoothing":0.82,"a":0.6}},{init_eqs:function(a){
a.xang=0;a.ampl=0;a.fov=0;a.winkel=0;a.t1=0;a.yang=0;a.t3=0;a.vol_m=0;a.my=0;a.oz=0;a.t_rel=0;a.pulse=0;a.exc=0;a.mz=0;a.q26=0;a.oy=0;a.mx=0;a.t2=0;a.vol=0;a.zang=0;a.monitor=0;a.t_abs=0;a.ox=0;
return a;},frame_eqs:function(a){
a.t1=Math.cos(div(a.time,3));a.t2=Math.sin(div(a.time,7));a.vol=a.mid_att+a.treb_att;a.vol_m=.999*a.vol_m+.001*a.vol;a.exc=above(a.vol,1.1*a.vol_m);a.pulse=.95*a.pulse+.05*a.exc;a.winkel+=div(a.pulse,3);a.t3=a.winkel;
return a;},point_eqs:function(a){
a.t_abs=a.sample;a.t_rel=a.sample-div(a.time,6);a.ampl=Math.sin(3*a.t_abs);a.ox=3*Math.sin(a.time)+a.ampl*Math.sin(267*a.t_rel);a.oy=3*Math.cos(a.time)+a.ampl*Math.cos(277*a.t_rel);a.oz=0*Math.cos(div(a.t_rel*a.time,23))+4*a.t_abs;a.r=sqr(Math.sin(3.4*a.t_rel));a.g=sqr(Math.sin(2.3*a.t_rel));a.b=sqr(Math.cos(.9*a.t_rel));a.a=.2*Math.cos(1*a.t_abs)+div(a.q26,16);a.xang=a.t2+div(a.t3,3);a.yang=a.t1*a.t2-div(a.t3,4);a.zang=a.t3;a.fov=.2;a.monitor=a.t2;a.mx=a.ox*Math.cos(a.zang)-
a.oy*Math.sin(a.zang);a.my=a.ox*Math.sin(a.zang)+a.oy*Math.cos(a.zang);a.ox=a.mx;a.oy=a.my;a.mx=a.ox*Math.cos(a.yang)+a.oz*Math.sin(a.yang);a.mz=-a.ox*Math.sin(a.yang)+a.oz*Math.cos(a.yang);a.ox=a.mx;a.oz=a.mz;a.my=a.oy*Math.cos(a.xang)-a.oz*Math.sin(a.xang);a.mz=a.oy*Math.sin(a.xang)+a.oz*Math.cos(a.xang);a.oy=a.my;a.oz=a.mz;a.oz-=6;a.x=div(a.ox*a.fov,a.oz)+.5;a.y=div(a.oy*a.fov,a.oz)+.5;
return a;}}),Object.assign({"baseVals":{"enabled":1,"samples":232,"usedots":1,"additive":1,"scaling":0.89152,"smoothing":0.82,"a":0.1}},{init_eqs:function(a){
a.xang=0;a.ampl=0;a.fov=0;a.t1=0;a.yang=0;a.my=0;a.oz=0;a.t_rel=0;a.mz=0;a.oy=0;a.mx=0;a.t2=0;a.zang=0;a.monitor=0;a.t_abs=0;a.ox=0;
return a;},frame_eqs:function(a){
a.t1=2*Math.sin(div(a.time,15));a.t2=2*Math.sin(div(a.time,11));a.monitor=a.time;
return a;},point_eqs:function(a){
a.t_abs=a.sample;a.t_rel=a.sample-div(a.time,5);a.ampl=a.time;a.ox=10*a.ampl*Math.sin(68*a.t_abs);a.oy=10*a.ampl*Math.cos(28*a.t_abs);a.oz=10*a.ampl*Math.cos(128*a.t_abs);a.r=Math.sin(1335*a.t_abs)+1;a.g=Math.sin(1783*a.t_abs)+1;a.b=div(Math.floor(randint(5)),5);a.a=.5+.25*Math.sin(15*a.t_rel);a.xang=a.t1;a.yang=a.t1;a.zang=a.t1;a.fov=.12;a.mx=a.ox*Math.cos(a.zang)-a.oy*Math.sin(a.zang);a.my=a.ox*Math.sin(a.zang)+a.oy*Math.cos(a.zang);a.ox=a.mx;a.oy=a.my;a.mx=a.ox*Math.cos(a.yang)+
a.oz*Math.sin(a.yang);a.mz=-a.ox*Math.sin(a.yang)+a.oz*Math.cos(a.yang);a.ox=a.mx;a.oz=a.mz;a.my=a.oy*Math.cos(a.xang)-a.oz*Math.sin(a.xang);a.mz=a.oy*Math.sin(a.xang)+a.oz*Math.cos(a.xang);a.oy=a.my;a.oz=a.mz;a.oz-=6;a.x=div(a.ox*a.fov,a.oz)+.5;a.y=div(a.oy*a.fov,a.oz)+.5;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.q8=0;
return a;},frame_eqs:function(a){

return a;},pixel_eqs:''}),
"Aderrasi + Geiss - Airhandler (Kali Mix) - Painterly Tendrils Colorfast":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":2.001,"decay":0.95,"echo_zoom":0.9996,"wave_mode":1,"wrap":0,"wave_a":3.072644,"wave_scale":1.285746,"wave_smoothing":0,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":1.331,"zoom":0.999513,"warp":0.0101,"wave_r":0.65,"wave_g":0.65,"wave_b":0.65,"ob_size":0.005,"ob_a":0.8,"ib_size":0,"mv_a":0},"warp":" shader_body { \n  vec3 tmpvar_1;\n  tmpvar_1 = max (texture (sampler_fc_main, uv).xyz, (texture (sampler_fc_main, mix (uv, uv_orig, vec2(0.33, 0.33))).xyz * 0.95));\n  vec2 x_2;\n  x_2 = (uv - uv_orig);\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = (((\n    mix (tmpvar_1, (floor((\n      (tmpvar_1 * vec3(7.0, 6.0, 8.0))\n     + 0.25)) / vec3(7.0, 6.0, 8.0)), vec3(0.1, 0.1, 0.1))\n   * 0.99) - 0.0025) - ((1.0 - \n    clamp ((sqrt(dot (x_2, x_2)) * 40.0), 0.0, 1.0)\n  ) * 0.003));\n  ret = tmpvar_3.xyz;\n }","comp":" shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1.x = cos((13.5 * uv.y));\n  tmpvar_1.y = sin((19.5 * uv.x));\n  vec4 tmpvar_2;\n  tmpvar_2.w = 1.0;\n  tmpvar_2.xyz = max (texture (sampler_main, uv).xyz, texture (sampler_main, (uv + (0.06 * tmpvar_1))).xyz);\n  ret = tmpvar_2.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){

return a;},frame_eqs:function(a){
a.wave_r+=.5*Math.sin(1.13*a.time);a.wave_g+=.5*Math.sin(1.23*a.time);a.wave_b+=.5*Math.sin(1.33*a.time);
return a;},pixel_eqs:function(a){
a.zoom+=.05*(Math.sin(6*a.ang)+.3*Math.sin(Math.sin(2*a.time*Math.sin(a.time)*a.rad))-.1*Math.cos(a.rad));a.rot+=.5*Math.sin(.5-a.rad)*Math.cos(.02*(.5-a.rad)+a.time);a.sx+=.01*(.99-a.rad)*Math.sin(.733*a.time)*below(Math.sin(a.time),0);a.sy+=.01*(.99-a.rad)*Math.cos(.953*a.time)*above(Math.sin(a.time),0);a.zoom-=.05*(1-a.rad)*below(a.rad,.5);
return a;}}),
"Cope - The Neverending Explosion of Red Liquid Fire":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.14,"decay":1,"echo_zoom":1,"wave_mode":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"wrap":0,"darken":1,"wave_a":0.001,"wave_scale":0.179,"wave_smoothing":0,"wave_mystery":0.3,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":1.331,"zoomexp":0.8195,"zoom":1.0697,"dy":0.006,"warp":0.01,"sx":0.9996,"wave_g":0,"wave_b":0,"ob_a":0.8,"ib_size":0,"ib_r":0,"ib_g":0,"ib_b":0,"ib_a":1,"mv_x":0,"mv_y":0,"mv_l":1,"mv_g":0.91,"mv_b":0.71,"mv_a":0},"pixel_eqs":"","warp":" shader_body { \n  vec3 noise2_1;\n  vec3 ret_2;\n  vec3 tmpvar_3;\n  tmpvar_3 = (((texture (sampler_blur1, uv).xyz * scale1) + bias1) + texture (sampler_main, uv).xyz);\n  vec2 tmpvar_4;\n  tmpvar_4 = (0.5 + ((uv - 0.5) * (1.0 + \n    (tmpvar_3.y * 0.05)\n  )));\n  vec2 tmpvar_5;\n  tmpvar_5.x = (tmpvar_4.x + pow (tmpvar_3.x, q17));\n  tmpvar_5.y = (tmpvar_4.y + pow (tmpvar_3.x, q18));\n  vec4 tmpvar_6;\n  tmpvar_6 = texture (sampler_fc_main, fract(tmpvar_5));\n  vec3 tmpvar_7;\n  tmpvar_7.x = q10;\n  tmpvar_7.y = q11;\n  tmpvar_7.z = q12;\n  noise2_1 = (texture (sampler_noise_lq, ((\n    (uv_orig * texsize.xy)\n   * texsize_noise_lq.zw) + rand_frame.xy)).xyz + ((tmpvar_7 * vec3(rad)) * vol));\n  vec3 a_8;\n  a_8 = (1.0 - tmpvar_6.xyz);\n  ret_2 = (tmpvar_6.xyz + (0.3 * clamp (\n    ((a_8.yzx * noise2_1.zxy) - (a_8.zxy * noise2_1.yzx))\n  , 0.0, 1.0)));\n  ret_2 = (ret_2 * 0.97);\n  vec4 tmpvar_9;\n  tmpvar_9.w = 1.0;\n  tmpvar_9.xyz = ret_2;\n  ret = tmpvar_9.xyz;\n }","comp":" shader_body { \n  vec3 ret_1;\n  ret_1 = (texture (sampler_main, uv).xyz * vec3(0.9, 0.3, 0.5));\n  ret_1 = (ret_1 * 1.34);\n  ret_1 = (ret_1 * ret_1);\n  vec4 tmpvar_2;\n  tmpvar_2.w = 1.0;\n  tmpvar_2.xyz = ret_1;\n  ret = tmpvar_2.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.q12=0;a.q18=0;a.q6=0;a.q5=0;a.bass_thresh=0;a.wg=0;a.q11=0;a.q10=0;a.wb=0;a.q17=0;a.vol=0;a.q2=0;a.q3=0;a.wr=0;a.q7=0;a.mtime=0;a.q8=0;
return a;},frame_eqs:function(a){
a.bass_thresh=2*above(a.bass_att,a.bass_thresh)+(1-above(a.bass_att,a.bass_thresh))*(.91*(a.bass_thresh-1.3)+1.3);a.wave_r=.5+.5*(.6*Math.sin(1.3*a.time)+.4*Math.sin(.98*a.time));a.wave_b=.5+.5*(.6*Math.sin(1.1*a.time)+.4*Math.sin(.78*a.time));a.wave_g=.5+.5*(.6*Math.sin(1.2*a.time)+.4*Math.sin(.6*a.time));a.q8=a.wave_r;a.q7=a.wave_b;a.q6=a.wave_g;a.wr=.5+.4*(.6*Math.sin(.2*a.time)+.4*Math.sin(.8*a.time));a.wb=.5+.4*(.6*Math.sin(.377*a.time)+.4*Math.sin(.5*a.time));a.wg=.5+
.4*(.6*Math.sin(.7*a.time)+.4*Math.sin(.4*a.time));a.q10=a.wr;a.q11=a.wb;a.q12=a.wg;a.q10=.8;a.q11=.2;a.q12=.1;a.q18=.01*Math.sin(.1*a.mtime);a.q17=-.01*Math.sin(.254*a.mtime);a.q2=a.bass_thresh;a.vol=.25*(a.bass+a.mid+a.treb);a.vol*=a.vol;a.q3=a.vol;a.q5=.5*a.vol;a.mtime+=.01*a.vol;a.q2=.25*a.mtime;
return a;},pixel_eqs:''}),
"fed - slowfast 1.1":()=>Object.assign({"baseVals":{"rating":5,"zoom":1.3345,"wave_r":0,"wave_g":0,"wave_b":0,"mv_a":0},"warp":" shader_body { \n  vec4 tmpvar_1;\n  tmpvar_1.w = 1.0;\n  tmpvar_1.xyz = ((texture (sampler_main, (uv_orig + \n    ((uv - uv_orig) * dot (texture (sampler_main, uv).xyz, vec3(0.32, 0.49, 0.29)))\n  )).xyz * 0.99) - 0.002);\n  ret = tmpvar_1.xyz;\n }","comp":" shader_body { \n  vec3 ret_1;\n  ret_1 = (texture (sampler_main, uv).xyz * 2.0);\n  ret_1 = (ret_1 * (1.0 - ret_1));\n  ret_1 = (((1.0 - \n    pow (clamp (ret_1, 0.0, 1.0), vec3(0.5, 0.5, 0.5))\n  ) * 1.5) - 0.75);\n  vec4 tmpvar_2;\n  tmpvar_2.w = 1.0;\n  tmpvar_2.xyz = ret_1;\n  ret = tmpvar_2.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"textured":1,"rad":0.64926,"tex_zoom":0.86996,"g":1,"b":1,"r2":1,"b2":1,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.oldshift=0;a.shift=0;a.normalframez=0;a.crash=0;a.nex=0;a.rshift=0;a.q1=0;a.zoom1=0;
return a;},frame_eqs:function(a){
a.dx=0;a.oldshift=a.shift;a.normalframez+=1;a.shift=above(a.bass_att,1)*above(a.treb_att,.9);a.crash=Math.abs(a.oldshift-a.shift);a.nex=1*equal(a.rshift,0)+2*equal(a.rshift,1);a.rshift=.00001<Math.abs(a.crash)?a.nex:a.rshift;a.monitor=a.rshift;a.wave_r=div(randint(200),200);a.wave_g=div(randint(200),200);a.wave_b=div(randint(200),200);a.warp=0;a.q1=above(a.bass_att,1.3);a.zoom1=a.zoom+.15-.3*mod(a.normalframez,2);a.zoom=.00001<Math.abs(a.shift)?a.zoom1:1;a.rot=a.rot-.1+.1*a.rshift;

return a;},pixel_eqs:function(a){
a.dy=.007*-below(a.y,.4)+.007*above(a.y,.6);
return a;}}),
"fiShbRaiN + flexi - witchcraft 2.0 - mash0000 - no one cares about mi, the note (major third)":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1,"decay":0.955,"echo_zoom":0.997,"echo_alpha":0.5,"echo_orient":1,"wave_mode":7,"additivewave":1,"modwavealphabyvolume":1,"wave_brighten":0,"wave_a":0.001,"wave_scale":1.286,"wave_smoothing":0.63,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":1.772,"zoomexp":5.00873,"fshader":1,"zoom":1.011,"rot":0.003,"warp":0,"wave_r":0.65,"wave_g":0.65,"wave_b":0.65,"ob_size":0.005,"ob_a":1,"mv_x":64,"mv_y":48,"mv_l":0,"mv_a":0},"pixel_eqs":"","warp":"","comp":" shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1 = (texsize.zw * 6.0);\n  vec2 tmpvar_2;\n  tmpvar_2.x = (((texture (sampler_blur1, \n    (uv + (vec2(1.0, 0.0) * tmpvar_1))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(1.0, 0.0) * tmpvar_1))\n  ).xyz * scale1) + bias1)).y;\n  tmpvar_2.y = (((texture (sampler_blur1, \n    (uv + (vec2(0.0, 1.0) * tmpvar_1))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(0.0, 1.0) * tmpvar_1))\n  ).xyz * scale1) + bias1)).y;\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = mix (mix ((vec3(0.4, 0.2, 0.9) * texture (sampler_fc_main, \n    (uv - (tmpvar_2 * 0.6))\n  ).x), vec3(2.0, 2.0, 2.0), vec3((\n    ((texture (sampler_blur1, uv).xyz * scale1) + bias1)\n  .y * 0.35))), vec3(1.0, 0.7, 0.0), vec3((texture (sampler_main, (0.5 + \n    ((uv - 0.5) * 0.9)\n  )).z * 0.8)));\n  ret = tmpvar_3.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":12,"additive":1,"num_inst":2,"x":0.49,"rad":0.04789,"tex_zoom":4.36077,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=div(randint(1E3),1E3);a.y=div(randint(1E3),1E3);a.ang=div(randint(150),100);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"thick":1,"additive":1,"r":0}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.bass,1)*.01*a.bass;a.ma-=3.1415*above(a.treb,1)*.01*a.treb;a.mx+=.0002*Math.cos(a.ma);a.my+=.0002*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.8);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"additive":1,"r":0}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.bass,1)*.05*a.bass;a.ma-=3.1415*above(a.mid,1)*.05*a.mid;a.mx+=.0001*Math.cos(a.ma);a.my+=.0001*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.1);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"additive":1,"r":0}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.mid,1)*.01*a.mid;a.ma-=3.1415*above(a.treb,1)*.01*a.treb;a.mx+=.0004*Math.cos(a.ma);a.my+=.0004*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.3);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"additive":1,"r":0}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.bass,.5)*.02*a.bass;a.ma-=3.1415*above(a.treb,.5)*.02*a.treb;a.mx+=.0008*Math.cos(a.ma);a.my+=.0008*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.2);
return a;}})],init_eqs:function(a){
a.t=0;
return a;},frame_eqs:function(a){
a.t=12.3*a.time;a.rot+=.03*(.6*Math.sin(.38*a.time)+.4*Math.sin(.54*a.time));a.dx+=.002*(.6*Math.sin(.434*a.time)+.4*Math.sin(.277*a.time));a.dy+=.002*(.6*Math.sin(.384*a.time)+.4*Math.sin(.477*a.time));
return a;},pixel_eqs:''}),
"fiShbRaiN + geiss - witchcraft (Grow Mix 3)":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1,"decay":0.955,"echo_zoom":0.997,"echo_alpha":0.5,"echo_orient":1,"wave_mode":7,"additivewave":1,"modwavealphabyvolume":1,"wave_brighten":0,"wrap":0,"wave_a":0.001,"wave_scale":1.286,"wave_smoothing":0.63,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":1.331,"fshader":1,"zoom":1.00951,"warp":0.01,"wave_r":0.65,"wave_g":0.65,"wave_b":0.65,"ob_size":0.5,"ob_r":0.01,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":0,"mv_a":0},"pixel_eqs":"","warp":" shader_body { \n  vec4 lums_1;\n  vec3 tmpvar_2;\n  tmpvar_2.z = 0.0;\n  tmpvar_2.xy = texsize.zw;\n  vec3 tmpvar_3;\n  tmpvar_3 = (tmpvar_2 * 3.0);\n  lums_1.x = dot (texture (sampler_main, (uv + (texsize.zw * tmpvar_3.xz))).xyz, vec3(0.32, 0.49, 0.29));\n  lums_1.y = dot (texture (sampler_main, (uv - (texsize.zw * tmpvar_3.xz))).xyz, vec3(0.32, 0.49, 0.29));\n  lums_1.z = dot (texture (sampler_main, (uv + (texsize.zw * tmpvar_3.zy))).xyz, vec3(0.32, 0.49, 0.29));\n  lums_1.w = dot (texture (sampler_main, (uv - (texsize.zw * tmpvar_3.zy))).xyz, vec3(0.32, 0.49, 0.29));\n  vec2 tmpvar_4;\n  tmpvar_4.x = (lums_1.x - lums_1.y);\n  tmpvar_4.y = (lums_1.z - lums_1.w);\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = (texture (sampler_fc_main, (uv + (\n    (((clamp (\n      ((((2300.0 * tmpvar_4) / 3.0) * 0.5) + 0.5)\n    , 0.0, 1.0) * 2.0) - 1.0) * 1.4)\n   * texsize.zw))).xyz * 0.965);\n  ret = tmpvar_5.xyz;\n }","comp":" shader_body { \n  vec3 ret_1;\n  ret_1 = ((texture (sampler_main, uv).xyz * 1.5) - 0.1);\n  ret_1.y = (ret_1 * 0.7).y;\n  ret_1.x = (((texture (sampler_blur1, uv).xyz * scale1) + bias1).x * 2.0);\n  ret_1.z = (((texture (sampler_blur2, uv).xyz * scale2) + bias2).z * 3.0);\n  vec4 tmpvar_2;\n  tmpvar_2.w = 1.0;\n  tmpvar_2.xyz = ret_1;\n  ret = tmpvar_2.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"thick":1}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.bass,1)*.01*a.bass;a.ma-=3.1415*above(a.treb,1)*.01*a.treb;a.mx+=.0002*Math.cos(a.ma);a.my+=.0002*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.8);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.bass,1)*.05*a.bass;a.ma-=3.1415*above(a.mid,1)*.05*a.mid;a.mx+=.0001*Math.cos(a.ma);a.my+=.0001*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.1);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.mid,1)*.01*a.mid;a.ma-=3.1415*above(a.treb,1)*.01*a.treb;a.mx+=.0004*Math.cos(a.ma);a.my+=.0004*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.3);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.bass,.5)*.02*a.bass;a.ma-=3.1415*above(a.treb,.5)*.02*a.treb;a.mx+=.0008*Math.cos(a.ma);a.my+=.0008*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.2);
return a;}})],init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},pixel_eqs:''}),
"fiShbRaiN - a quiet death":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1,"decay":0.925,"echo_zoom":0.996624,"echo_alpha":0.5,"echo_orient":2,"wave_mode":1,"additivewave":1,"modwavealphabyvolume":1,"wave_brighten":0,"wrap":0,"wave_a":0.711381,"wave_scale":1.163966,"wave_smoothing":0.81,"wave_mystery":-0.6,"modwavealphastart":1.11,"modwavealphaend":1.3,"warpanimspeed":0.184233,"warpscale":1.204928,"zoomexp":5.582155,"zoom":1.019604,"warp":0.104292,"sx":0.998168,"sy":1.051003,"wave_r":0.65,"wave_g":0.65,"wave_b":0.65,"ob_size":0.5,"ob_r":0.01,"ib_size":0.26,"mv_x":19.199999,"mv_y":24.000004,"mv_dx":0.02,"mv_l":1.699999,"mv_g":0,"mv_b":0.8,"mv_a":0.1},"warp":"","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":1,"additive":1,"textured":1,"rad":0.599579,"tex_zoom":2.216689,"g":0.7,"b":1,"a":0.1,"g2":0.4,"b2":0.7,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.ang=3.1415*Math.sin(a.time)+a.bass-a.treb;a.rad=a.treb;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":100,"textured":1,"y":0.2,"rad":0.241456,"tex_zoom":0.344205,"r":0.7,"g":0.5,"b":1,"a":0.6,"g2":0,"b2":0.1,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.5*Math.sin(.2*a.time)+.5;a.y=Math.sin(a.time);a.rad=Math.sin(.23*a.time);a.ang=Math.sin(.5*a.time);
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":3,"textured":1,"rad":0.54279,"tex_zoom":0.999992,"r":0,"b":1,"a":0,"r2":0.9,"g2":0.6,"b2":1,"a2":0.2,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.ang=above(a.bass,1)*Math.sin(a.time)+Math.cos(a.time);a.x=.1*randint(10);a.y=.1*randint(10);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"spectrum":1,"usedots":1,"additive":1,"scaling":1.816691}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.a=.5*a.bass;
return a;},point_eqs:function(a){
a.x=.5*Math.sin(3.1415*mod(100*a.sample,10)*a.bass*.02)+.5*Math.sin(a.treb);a.r=.25-a.y;a.g=.5*a.treb;a.b=a.y-.5;
return a;}}),Object.assign({"baseVals":{"enabled":1,"spectrum":1,"usedots":1,"thick":1,"scaling":0.819543,"a":0.1}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.x=.5*Math.cos(mod(100*a.sample,20))+.5;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){

return a;},frame_eqs:function(a){
a.dx+=.002*Math.sin(a.time);
return a;},pixel_eqs:function(a){
a.zoom+=Math.abs(Math.sin(a.time))*a.rad*.04;
return a;}}),
"fiShbRaiN - breakfast cruiser":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1,"decay":0.925,"echo_zoom":1.498684,"echo_alpha":0.6,"wave_mode":5,"additivewave":1,"wave_dots":1,"wave_thick":1,"wave_brighten":0,"wrap":0,"wave_a":0.763004,"wave_scale":2.114586,"wave_smoothing":0.9,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":8.815298,"zoomexp":8.311067,"fshader":0.5,"zoom":1.009509,"dy":0.02,"warp":3.209173,"sx":0.94204,"sy":0.999996,"wave_r":0.65,"wave_g":0.65,"wave_b":0.65,"ob_size":0.5,"ob_r":0.01,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":0.05,"mv_g":0.4,"mv_a":0},"warp":"","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":1,"additive":1,"textured":1,"rad":0.662308,"a":0.7,"r2":0.2,"g2":0.6,"b2":0.9,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"additive":1}},{init_eqs:function(a){
a.nd=0;a.nx=0;a.ny=0;a.nx=.5;a.ny=.5;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.nd=randint(4);a.nx+=.01*equal(a.nd,0)*a.mid;a.nx+=-.01*equal(a.nd,2)*a.mid;a.ny+=.01*equal(a.nd,1)*a.mid;a.ny+=-.01*equal(a.nd,3)*a.mid;a.x=a.nx;a.y=a.ny;a.r=.6*a.bass;a.g=.6*a.treb;a.nx=.00001<Math.abs(equal(a.sample,1))?.1*randint(10):a.nx;a.ny=.00001<Math.abs(equal(a.sample,1))?.1*randint(10):a.ny;
return a;}}),Object.assign({"baseVals":{"enabled":1,"usedots":1,"a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},pixel_eqs:function(a){
a.wave_r=Math.sin(a.time);a.wave_b=Math.sin(.23*a.time);a.wave_g=Math.sin(.47*a.time);
return a;}}),
"flexi + geiss - pogo-cubes on tokamak matter (bccn Jelly V4)":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1,"decay":0.995,"echo_zoom":1.007,"echo_orient":3,"additivewave":1,"modwavealphabyvolume":1,"wave_brighten":0,"wrap":0,"wave_a":1.413,"wave_scale":0.418,"wave_smoothing":0,"wave_mystery":-0.66,"modwavealphastart":2,"modwavealphaend":2,"warpanimspeed":0.626,"warpscale":1.331,"zoomexp":1.00001,"zoom":0.99951,"warp":0.08925,"wave_r":0,"wave_g":0,"wave_x":0.24,"wave_y":0.44,"ob_size":0.5,"ob_r":0.01,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":0,"mv_a":0},"warp":" shader_body { \n  vec3 ret_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = (texsize.zw * 8.0);\n  ret_1.xz = vec2(0.0, 0.0);\n  vec2 tmpvar_3;\n  tmpvar_3 = fract(uv);\n  ret_1.y = texture (sampler_fc_main, tmpvar_3).y;\n  ret_1.y = (ret_1.y + ((\n    ((ret_1.y - ((texture (sampler_blur3, tmpvar_3).xyz * scale3) + bias3).y) - 0.03)\n   * 0.6) - 0.06));\n  ret_1.y = (ret_1.y + ((\n    (texture (sampler_blur3, uv_orig).xyz * scale3)\n   + bias3).x * 0.3));\n  vec2 tmpvar_4;\n  tmpvar_4.x = (((texture (sampler_blur1, \n    (uv_orig + (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv_orig - (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1)).z;\n  tmpvar_4.y = (((texture (sampler_blur1, \n    (uv_orig + (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv_orig - (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1)).z;\n  ret_1.z = (texture (sampler_fc_main, (mix (uv_orig, uv, vec2(0.3, 0.3)) + (\n    (tmpvar_4 * texsize.zw)\n   * 8.0))).z - 0.03);\n  ret_1.z = (ret_1.z + ((\n    clamp ((0.2 - ((texture (sampler_blur2, uv).xyz * scale2) + bias2).y), 0.0, 1.0)\n   * 0.1) + (\n    ((texture (sampler_blur2, uv_orig).xyz * scale2) + bias2)\n  .x * 0.2)));\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = ret_1;\n  ret = tmpvar_5.xyz;\n }","comp":" shader_body { \n  vec3 ret2_1;\n  vec3 ret_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = (texsize.zw * 6.0);\n  vec2 tmpvar_4;\n  tmpvar_4.x = dot (((\n    (texture (sampler_blur1, (uv + (vec2(1.0, 0.0) * tmpvar_3))).xyz * scale1)\n   + bias1) - (\n    (texture (sampler_blur1, (uv - (vec2(1.0, 0.0) * tmpvar_3))).xyz * scale1)\n   + bias1)), vec3(0.32, 0.49, 0.29));\n  tmpvar_4.y = dot (((\n    (texture (sampler_blur1, (uv + (vec2(0.0, 1.0) * tmpvar_3))).xyz * scale1)\n   + bias1) - (\n    (texture (sampler_blur1, (uv - (vec2(0.0, 1.0) * tmpvar_3))).xyz * scale1)\n   + bias1)), vec3(0.32, 0.49, 0.29));\n  vec2 tmpvar_5;\n  tmpvar_5 = (uv - (0.25 * tmpvar_4));\n  vec4 tmpvar_6;\n  tmpvar_6 = texture (sampler_blur3, uv);\n  ret_2 = (0.3 * ((tmpvar_6.xyz * scale3) + bias3));\n  ret_2 = (ret_2 - ((\n    (texture (sampler_blur2, uv).xyz * scale2)\n   + bias2) - 0.01));\n  vec4 tmpvar_7;\n  tmpvar_7 = texture (sampler_blur1, uv);\n  ret_2 = (ret_2 + ((texture (sampler_main, uv).xyz + \n    (((tmpvar_7.xyz * scale1) + bias1) * 0.15)\n  ) - 0.01));\n  ret_2 = (ret_2 + 0.75);\n  float tmpvar_8;\n  tmpvar_8 = dot (ret_2, vec3(0.32, 0.49, 0.29));\n  vec3 tmpvar_9;\n  tmpvar_9 = mix (vec3(tmpvar_8), (vec3(tmpvar_8) * dot (\n    ((0.815 * ((texture (sampler_blur3, tmpvar_5).xyz * scale3) + bias3)) - ((texture (sampler_blur1, tmpvar_5).xyz * scale1) + bias1))\n  , vec3(0.32, 0.49, 0.29))), pow (hue_shader, vec3(tmpvar_8)));\n  ret2_1 = ((-0.3 * (\n    (texture (sampler_blur3, tmpvar_5).xyz * scale3)\n   + bias3)) + ((texture (sampler_blur1, tmpvar_5).xyz * scale1) + bias1));\n  ret2_1 = (ret2_1 - texture (sampler_main, tmpvar_5).xyz);\n  ret2_1 = (ret2_1 - 0.75);\n  float tmpvar_10;\n  tmpvar_10 = dot (ret2_1, vec3(0.32, 0.49, 0.29));\n  vec3 tmpvar_11;\n  tmpvar_11 = mix (vec3(tmpvar_10), (vec3(tmpvar_10) * dot (\n    ((0.815 * ((tmpvar_6.xyz * scale3) + bias3)) - ((tmpvar_7.xyz * scale1) + bias1))\n  , vec3(0.32, 0.49, 0.29))), pow (hue_shader.zxy, tmpvar_9));\n  ret2_1 = tmpvar_11;\n  vec3 tmpvar_12;\n  tmpvar_12 = abs((tmpvar_9 - (2.0 * tmpvar_11)));\n  ret_2 = (tmpvar_12 - (0.175 * sqrt(tmpvar_12)));\n  ret_2 = (ret_2 * ret_2);\n  vec4 tmpvar_13;\n  tmpvar_13.w = 1.0;\n  tmpvar_13.xyz = ret_2;\n  ret = tmpvar_13.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"additive":1,"rad":0.0277,"ang":6.03186,"tex_ang":6.03186,"tex_zoom":0.6839,"r2":1,"g2":0,"a2":1,"border_r":0,"border_g":0,"border_b":0,"border_a":1}},{init_eqs:function(a){
a.an=0;a.q6=0;a.q4=0;a.q5=0;a.q3=0;a.q2=0;a.q1=0;
return a;},frame_eqs:function(a){
a.an+=a.q6;a.ang=.5*a.an;a.x=a.q4;a.y=a.q5;a.rad=a.q3*sqrt(2);a.x=.5+div(a.x-.5,a.q2);a.y=.5+div(a.y-.5,a.q1);
return a;}}),Object.assign({"baseVals":{"enabled":1,"additive":1,"rad":0.0277,"ang":6.03186,"tex_ang":6.03186,"tex_zoom":0.6839,"r2":1,"g2":0,"a2":1,"border_r":0,"border_g":0,"border_b":0,"border_a":1}},{init_eqs:function(a){
a.an=0;a.q9=0;a.q7=0;a.q8=0;a.q3=0;a.q2=0;a.q1=0;
return a;},frame_eqs:function(a){
a.an+=a.q9;a.ang=.5*a.an;a.x=a.q7;a.y=a.q8;a.rad=a.q3*sqrt(2);a.x=.5+div(a.x-.5,a.q2);a.y=.5+div(a.y-.5,a.q1);
return a;}}),Object.assign({"baseVals":{"enabled":1,"additive":1,"rad":0.0277,"ang":6.03186,"tex_ang":6.03186,"tex_zoom":0.6839,"r2":1,"g2":0,"a2":1,"border_r":0,"border_g":0,"border_b":0,"border_a":1}},{init_eqs:function(a){
a.an=0;a.q12=0;a.q10=0;a.q11=0;a.q3=0;a.q2=0;a.q1=0;
return a;},frame_eqs:function(a){
a.an+=a.q12;a.ang=.5*a.an;a.x=a.q10;a.y=a.q11;a.rad=a.q3*sqrt(2);a.x=.5+div(a.x-.5,a.q2);a.y=.5+div(a.y-.5,a.q1);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"thick":1,"additive":1,"scaling":2.0231,"smoothing":0,"r":0}},{init_eqs:function(a){
a.d=0;a.tt2=0;a.res=0;a.tt1=0;a.diff=0;a.tt3=0;a.beat=0;a.vol=0;a.m=0;a.monitor=0;a.t2=0;a.t3=0;a.t4=0;a.cl=0;
return a;},frame_eqs:function(a){
a.vol=8*a.bass+5*a.mid+3*a.treb;a.m=.97*a.m+.08*a.vol;a.monitor=a.vol;a.beat=above(a.vol,a.res)*above(a.vol,a.m)*above(a.vol,16);a.diff=(1-a.beat)*a.diff+a.beat*(a.vol-a.res);a.res=a.beat*(a.vol+.04*a.m)+(1-a.beat)*(a.res-div(60*(.1+.02*a.diff),a.fps));a.res=Math.max(0,a.res);a.a=a.beat;
return a;},point_eqs:function(a){
a.tt3=.6*a.tt3+1*a.value1;a.tt2=.7*a.tt2+.2*a.tt3;a.tt1=.8*a.tt1+.1*a.tt2;a.d=.9*a.d+.2*a.tt1;a.y=.5+a.d*a.sample*(1-a.sample)*2;a.x=-.05+1.1*a.sample;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.y3=0;a.y1=0;a.q12=0;a.w2=0;a.ref_ang=0;a.du=0;a.x1=0;a.vx3=0;a.q13=0;a.q6=0;a.q1=0;a.q5=0;a.q9=0;a.vx1=0;a.mult=0;a.x3=0;a.q11=0;a.q10=0;a.ang2=0;a.dv=0;a.vr3=0;a.vr2=0;a.q4=0;a.bounce=0;a.vr=0;a.v2r=0;a.w1=0;a.r=0;a.x2=0;a.vy2=0;a.y2=0;a.vy1=0;a.q2=0;a.q14=0;a.dist=0;a.vr1=0;a.v1=0;a.vx2=0;a.q3=0;a.q7=0;a.vy3=0;a.v2=0;a.q8=0;a.x1=.5;a.y1=.6;a.x2=.5;a.y2=.4;a.x3=.5;a.y3=.2;a.vr1=.0001;a.vr2=0;a.vr3=0;a.vx1=0;a.vx2=0;a.vx3=0;
return a;},frame_eqs:function(a){
a.zoom=1;a.warp=0;a.wave_a=0;a.r=.03+.004*(a.bass_att+a.treb_att);a.monitor=a.aspecty;a.vr=Math.sin(a.vr1)*a.r;a.bounce=below(a.y1,a.r-.5*(a.aspectx-1));a.y1+=a.vy1;a.vy1=.00001<Math.abs(a.bounce)?.96*Math.abs(a.vy1)+.1*(a.r-a.y1-.5*(a.aspectx-1)):a.vy1-div(.018,a.fps);a.vx1=.00001<Math.abs(a.bounce)?a.vx1+.15*(a.vr-a.vx1):a.vx1;a.vr=.00001<Math.abs(a.bounce)?a.vr+.85*(a.vx1-a.vr):a.vr;a.vr1=Math.asin(div(a.vr,a.r));a.bounce=above(a.x1,1-a.r+.5*(a.aspecty-1));a.vx1=.00001<Math.abs(a.bounce)?
.96*-Math.abs(a.vx1)+.1*(1-a.r-a.x1+.5*(a.aspecty-1)):a.vx1;a.vy1=.00001<Math.abs(a.bounce)?a.vy1+.15*(a.vr-a.vy1):a.vy1;a.vr=.00001<Math.abs(a.bounce)?a.vr+.85*(a.vy1-a.vr):a.vr;a.vr1=Math.asin(div(a.vr,a.r));a.bounce=below(a.x1,a.r-.5*(a.aspecty-1));a.x1+=a.vx1;a.vx1=.00001<Math.abs(a.bounce)?.96*Math.abs(a.vx1)+.1*(a.r-a.x1-.5*(a.aspecty-1)):a.vx1;a.vy1=.00001<Math.abs(a.bounce)?a.vy1+.15*(-a.vr-a.vy1):a.vy1;a.vr=.00001<Math.abs(a.bounce)?a.vr-.85*(a.vy1+a.vr):a.vr;a.vr1=Math.asin(div(a.vr,a.r));
a.vr=Math.sin(a.vr2)*a.r;a.bounce=below(a.y2,a.r-.5*(a.aspectx-1));a.y2+=a.vy2;a.vy2=.00001<Math.abs(a.bounce)?.96*Math.abs(a.vy2)+.1*(a.r-a.y2-.5*(a.aspectx-1)):a.vy2-div(.018,a.fps);a.vx2=.00001<Math.abs(a.bounce)?a.vx2+.15*(a.vr-a.vx2):a.vx2;a.vr=.00001<Math.abs(a.bounce)?a.vr+.85*(a.vx2-a.vr):a.vr;a.vr2=Math.asin(div(a.vr,a.r));a.bounce=above(a.x2,1-a.r+.5*(a.aspecty-1));a.vx2=.00001<Math.abs(a.bounce)?.96*-Math.abs(a.vx2)+.1*(1-a.r-a.x2+.5*(a.aspecty-1)):a.vx2;a.vy2=.00001<Math.abs(a.bounce)?
a.vy2+.15*(a.vr-a.vy2):a.vy2;a.vr=.00001<Math.abs(a.bounce)?a.vr+.85*(a.vy2-a.vr):a.vr;a.vr2=Math.asin(div(a.vr,a.r));a.bounce=below(a.x2,a.r-.5*(a.aspecty-1));a.x2+=a.vx2;a.vx2=.00001<Math.abs(a.bounce)?.96*Math.abs(a.vx2)+.1*(a.r-a.x2-.5*(a.aspecty-1)):a.vx2;a.vy2=.00001<Math.abs(a.bounce)?a.vy2+.15*(-a.vr-a.vy2):a.vy2;a.vr=.00001<Math.abs(a.bounce)?a.vr-.85*(a.vy2+a.vr):a.vr;a.vr2=Math.asin(div(a.vr,a.r));a.vr=Math.sin(a.vr3)*a.r;a.bounce=below(a.y3,a.r-.5*(a.aspectx-1));a.y3+=a.vy3;a.vy3=.00001<
Math.abs(a.bounce)?.96*Math.abs(a.vy3)+.1*(a.r-a.y3-.5*(a.aspectx-1)):a.vy3-div(.018,a.fps);a.vx3=.00001<Math.abs(a.bounce)?a.vx3+.15*(a.vr-a.vx3):a.vx3;a.vr=.00001<Math.abs(a.bounce)?a.vr+.85*(a.vx3-a.vr):a.vr;a.vr3=Math.asin(div(a.vr,a.r));a.bounce=above(a.x3,1-a.r+.5*(a.aspecty-1));a.vx3=.00001<Math.abs(a.bounce)?.96*-Math.abs(a.vx3)+.1*(1-a.r-a.x3+.5*(a.aspecty-1)):a.vx3;a.vy3=.00001<Math.abs(a.bounce)?a.vy3+.15*(a.vr-a.vy3):a.vy3;a.vr=.00001<Math.abs(a.bounce)?a.vr+.85*(a.vy3-a.vr):a.vr;a.vr3=
Math.asin(div(a.vr,a.r));a.bounce=below(a.x3,a.r-.5*(a.aspecty-1));a.x3+=a.vx3;a.vx3=.00001<Math.abs(a.bounce)?.96*Math.abs(a.vx3)+.1*(a.r-a.x3-.5*(a.aspecty-1)):a.vx3;a.vy3=.00001<Math.abs(a.bounce)?a.vy3+.15*(-a.vr-a.vy3):a.vy3;a.vr=.00001<Math.abs(a.bounce)?a.vr-.85*(a.vy3+a.vr):a.vr;a.vr3=Math.asin(div(a.vr,a.r));a.bounce=below(sqrt(sqr(a.x1+a.vx1-a.x2-a.vx2)+sqr(a.y1+a.vy1-a.y2-a.vy2)),2*a.r);a.bounce*=below(sqrt(sqr(a.x1+a.vx1-a.x2-a.vx2)+sqr(a.y1+a.vy1-a.y2-a.vy2)),sqrt(sqr(a.x1-a.x2)+sqr(a.y1-
a.y2)));a.ref_ang=Math.atan2(a.x2-a.x1,a.y2-a.y1)+Math.asin(1);a.v1=sqrt(a.vx1*a.vx1+a.vy1*a.vy1);a.v2=sqrt(a.vx2*a.vx2+a.vy2*a.vy2);a.w1=Math.atan2(a.vx1,a.vy1);a.w2=Math.atan2(a.vx2,a.vy2);a.vr=Math.sin(a.vr1)*a.r;a.v2r=Math.sin(a.vr2)*a.r;a.vx1=.00001<Math.abs(a.bounce)?Math.sin(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang)+.1*(a.vr-a.v2r-Math.sin(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang))+Math.sin(a.ref_ang+Math.asin(1))*a.v2*Math.cos(a.w2-a.ref_ang-Math.asin(1)):a.vx1;a.vy1=.00001<Math.abs(a.bounce)?
Math.cos(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang)+.1*(a.vr-a.v2r-Math.cos(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang))+Math.cos(a.ref_ang+Math.asin(1))*a.v2*Math.cos(a.w2-a.ref_ang-Math.asin(1)):a.vy1;a.vx2=.00001<Math.abs(a.bounce)?Math.sin(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang)+.1*(a.v2r-a.vr-Math.sin(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang))+Math.sin(a.ref_ang+Math.asin(1))*a.v1*Math.cos(a.w1-a.ref_ang-Math.asin(1)):a.vx2;a.vy2=.00001<Math.abs(a.bounce)?Math.cos(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang)+
.1*(a.v2r-a.vr-Math.cos(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang))+Math.cos(a.ref_ang+Math.asin(1))*a.v1*Math.cos(a.w1-a.ref_ang-Math.asin(1)):a.vy2;a.vr=.00001<Math.abs(a.bounce)?a.vr+.9*(Math.cos(a.w1-a.ref_ang)*(a.v1-a.v2)-a.vr):a.vr;a.vr1=Math.asin(div(a.vr,a.r));a.v2r=.00001<Math.abs(a.bounce)?a.v2r+.9*(Math.cos(a.w2-a.ref_ang)*(a.v2-a.v1)-a.v2r):a.v2r;a.vr2=Math.asin(div(a.v2r,a.r));a.bounce=below(sqrt(sqr(a.x1+a.vx1-a.x3-a.vx3)+sqr(a.y1+a.vy1-a.y3-a.vy3)),2*a.r);a.bounce*=below(sqrt(sqr(a.x1+
a.vx1-a.x3-a.vx3)+sqr(a.y1+a.vy1-a.y3-a.vy3)),sqrt(sqr(a.x1-a.x3)+sqr(a.y1-a.y3)));a.ref_ang=Math.atan2(a.x3-a.x1,a.y3-a.y1)+Math.asin(1);a.v1=sqrt(a.vx1*a.vx1+a.vy1*a.vy1);a.v2=sqrt(a.vx3*a.vx3+a.vy3*a.vy3);a.w1=Math.atan2(a.vx1,a.vy1);a.w2=Math.atan2(a.vx3,a.vy3);a.vr=Math.sin(a.vr1)*a.r;a.v2r=Math.sin(a.vr3)*a.r;a.vx1=.00001<Math.abs(a.bounce)?Math.sin(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang)+.1*(a.vr-a.v2r-Math.sin(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang))+Math.sin(a.ref_ang+Math.asin(1))*a.v2*
Math.cos(a.w2-a.ref_ang-Math.asin(1)):a.vx1;a.vy1=.00001<Math.abs(a.bounce)?Math.cos(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang)+.1*(a.vr-a.v2r-Math.cos(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang))+Math.cos(a.ref_ang+Math.asin(1))*a.v2*Math.cos(a.w2-a.ref_ang-Math.asin(1)):a.vy1;a.vx3=.00001<Math.abs(a.bounce)?Math.sin(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang)+.1*(a.v2r-a.vr-Math.sin(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang))+Math.sin(a.ref_ang+Math.asin(1))*a.v1*Math.cos(a.w1-a.ref_ang-Math.asin(1)):a.vx3;
a.vy3=.00001<Math.abs(a.bounce)?Math.cos(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang)+.1*(a.v2r-a.vr-Math.cos(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang))+Math.cos(a.ref_ang+Math.asin(1))*a.v1*Math.cos(a.w1-a.ref_ang-Math.asin(1)):a.vy3;a.vr=.00001<Math.abs(a.bounce)?a.vr+.9*(Math.cos(a.w1-a.ref_ang)*(a.v1-a.v2)-a.vr):a.vr;a.vr1=Math.asin(div(a.vr,a.r));a.v2r=.00001<Math.abs(a.bounce)?a.v2r+.9*(Math.cos(a.w2-a.ref_ang)*(a.v2-a.v1)-a.v2r):a.v2r;a.vr3=Math.asin(div(a.v2r,a.r));a.bounce=below(sqrt(sqr(a.x3+
a.vx3-a.x2-a.vx2)+sqr(a.y3+a.vy3-a.y2-a.vy2)),2*a.r);a.bounce*=below(sqrt(sqr(a.x2+a.vx2-a.x3-a.vx3)+sqr(a.y2+a.vy2-a.y3-a.vy3)),sqrt(sqr(a.x2-a.x3)+sqr(a.y2-a.y3)));a.ref_ang=Math.atan2(a.x2-a.x3,a.y2-a.y3)+Math.asin(1);a.v1=sqrt(a.vx3*a.vx3+a.vy3*a.vy3);a.v2=sqrt(a.vx2*a.vx2+a.vy2*a.vy2);a.w1=Math.atan2(a.vx3,a.vy3);a.w2=Math.atan2(a.vx2,a.vy2);a.vr=Math.sin(a.vr3)*a.r;a.v2r=Math.sin(a.vr2)*a.r;a.vx3=.00001<Math.abs(a.bounce)?Math.sin(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang)+.1*(a.vr-a.v2r-Math.sin(a.ref_ang)*
a.v1*Math.cos(a.w1-a.ref_ang))+Math.sin(a.ref_ang+Math.asin(1))*a.v2*Math.cos(a.w2-a.ref_ang-Math.asin(1)):a.vx3;a.vy3=.00001<Math.abs(a.bounce)?Math.cos(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang)+.1*(a.vr-a.v2r-Math.cos(a.ref_ang)*a.v1*Math.cos(a.w1-a.ref_ang))+Math.cos(a.ref_ang+Math.asin(1))*a.v2*Math.cos(a.w2-a.ref_ang-Math.asin(1)):a.vy3;a.vx2=.00001<Math.abs(a.bounce)?Math.sin(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang)+.1*(a.v2r-a.vr-Math.sin(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang))+Math.sin(a.ref_ang+
Math.asin(1))*a.v1*Math.cos(a.w1-a.ref_ang-Math.asin(1)):a.vx2;a.vy2=.00001<Math.abs(a.bounce)?Math.cos(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang)+.1*(a.v2r-a.vr-Math.cos(a.ref_ang)*a.v2*Math.cos(a.w2-a.ref_ang))+Math.cos(a.ref_ang+Math.asin(1))*a.v1*Math.cos(a.w1-a.ref_ang-Math.asin(1)):a.vy2;a.vr=.00001<Math.abs(a.bounce)?a.vr+.9*(Math.cos(a.w1-a.ref_ang)*(a.v1-a.v2)-a.vr):a.vr;a.vr3=Math.asin(div(a.vr,a.r));a.v2r=.00001<Math.abs(a.bounce)?a.v2r+.9*(Math.cos(a.w2-a.ref_ang)*(a.v2-a.v1)-a.v2r):a.v2r;
a.vr2=Math.asin(div(a.v2r,a.r));a.q1=a.aspectx;a.q2=a.aspecty;a.q3=2*a.r;a.q4=a.x1;a.q5=a.y1;a.q6=a.vr1;a.q7=a.x2;a.q8=a.y2;a.q9=a.vr2;a.q10=a.x3;a.q11=a.y3;a.q12=a.vr3;a.q13=Math.atan2(div(a.x1+a.x2+a.x3,3)-.5,div(a.y1+a.y2+a.y3,3)-.5);a.q14=.2*sigmoid(sqrt(sqr(div(a.x1+a.x2+a.x3,3)-.5)+sqr(div(a.y1+a.y2+a.y3,3)-.5)),2);
return a;},pixel_eqs:function(a){
a.du=2*a.x-1-div(2*(a.q4+a.q7+a.q10-1.5),3);a.dv=2*a.y-1+div(2*(a.q5+a.q8+a.q11-1.5),3);a.dist=sqrt(a.du*a.du+a.dv*a.dv);a.ang2=Math.atan2(a.du,a.dv);a.mult=.4*Math.sin(.05*a.dist)*a.q14;a.dx=a.mult*Math.sin(2*a.ang2+a.q13)*a.aspectx;a.dy=a.mult*Math.cos(2*a.ang2+a.q13)*a.aspecty;
return a;}}),
"Flexi + stahlregen - jelly showoff parade":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1,"decay":1,"modwavealphabyvolume":1,"wave_a":0.207,"wave_scale":0.397,"wave_smoothing":0,"wave_mystery":0.24,"modwavealphaend":1.17,"warpscale":16.016,"zoomexp":11.56276,"zoom":1.05971,"warp":0.13126,"ob_size":0.005,"ob_a":1,"ib_size":0,"mv_x":64,"mv_y":48,"mv_l":0,"mv_r":0.35,"mv_g":0.35,"mv_b":0.35,"mv_a":0},"warp":" shader_body { \n  vec2 uv_1;\n  vec3 ret_2;\n  uv_1 = (0.5 + ((uv - 0.5) * 1.002));\n  vec2 tmpvar_3;\n  tmpvar_3 = (texsize.zw * 8.0);\n  vec3 tmpvar_4;\n  tmpvar_4 = (((texture (sampler_blur1, \n    (uv_1 + (vec2(1.0, 0.0) * tmpvar_3))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv_1 - (vec2(1.0, 0.0) * tmpvar_3))\n  ).xyz * scale1) + bias1));\n  vec3 tmpvar_5;\n  tmpvar_5 = (((texture (sampler_blur1, \n    (uv_1 + (vec2(0.0, 1.0) * tmpvar_3))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv_1 - (vec2(0.0, 1.0) * tmpvar_3))\n  ).xyz * scale1) + bias1));\n  vec2 tmpvar_6;\n  tmpvar_6.x = tmpvar_4.x;\n  tmpvar_6.y = tmpvar_5.x;\n  vec2 tmpvar_7;\n  tmpvar_7 = fract(((0.5 + \n    (uv_1 - 0.5)\n  ) - (tmpvar_6 * texsize.zw)));\n  ret_2.x = texture (sampler_main, tmpvar_7).x;\n  ret_2.x = (ret_2.x + ((\n    (ret_2.x - ((texture (sampler_blur2, tmpvar_7).xyz * scale2) + bias2))\n  .x * 0.4) + 0.006));\n  vec2 tmpvar_8;\n  tmpvar_8.x = tmpvar_5.x;\n  tmpvar_8.y = -(tmpvar_4.x);\n  vec2 tmpvar_9;\n  tmpvar_9.x = tmpvar_4.z;\n  tmpvar_9.y = tmpvar_5.z;\n  ret_2.z = max ((clamp (\n    (((texture (sampler_blur1, uv_1).xyz * scale1) + bias1).x - 0.3)\n  , 0.0, 1.0) * 2.0), (texture (sampler_fc_main, (\n    (uv_1 - ((tmpvar_8 * texsize.zw) * 8.0))\n   + \n    ((tmpvar_9 * texsize.zw) * 4.0)\n  )).z - 0.008));\n  vec2 tmpvar_10;\n  tmpvar_10.x = tmpvar_4.y;\n  tmpvar_10.y = tmpvar_5.y;\n  ret_2.y = max (ret_2.x, (texture (sampler_fc_main, (uv_1 + \n    (tmpvar_10 * texsize.zw)\n  )).y - 0.016));\n  vec4 tmpvar_11;\n  tmpvar_11.w = 1.0;\n  tmpvar_11.xyz = ret_2;\n  ret = tmpvar_11.xyz;\n }","comp":" shader_body { \n  vec3 ret_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = (texsize.zw * 6.0);\n  vec3 tmpvar_3;\n  tmpvar_3 = (((texture (sampler_blur1, \n    (uv + (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1));\n  vec3 tmpvar_4;\n  tmpvar_4 = (((texture (sampler_blur1, \n    (uv + (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1));\n  vec2 tmpvar_5;\n  tmpvar_5.x = dot (tmpvar_3, vec3(0.32, 0.49, 0.29));\n  tmpvar_5.y = dot (tmpvar_4, vec3(0.32, 0.49, 0.29));\n  vec2 tmpvar_6;\n  tmpvar_6 = (uv - (0.25 * tmpvar_5));\n  vec2 tmpvar_7;\n  tmpvar_7.x = dot (tmpvar_3, vec3(0.32, 0.49, 0.29));\n  tmpvar_7.y = dot (tmpvar_4, vec3(0.32, 0.49, 0.29));\n  vec2 tmpvar_8;\n  tmpvar_8 = (uv + (0.25 * tmpvar_7));\n  ret_1 = ((0.8 * (\n    (texture (sampler_blur3, tmpvar_6).xyz * scale3)\n   + bias3)) - ((texture (sampler_blur1, tmpvar_6).xyz * scale1) + bias1));\n  ret_1 = (ret_1 + (0.6 * (\n    (texture (sampler_blur1, uv).xyz * scale1)\n   + bias1)));\n  ret_1 = (ret_1 - ((\n    (texture (sampler_blur2, tmpvar_8).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur1, tmpvar_8).xyz * scale1)\n   + bias1)));\n  ret_1 = (ret_1 + ((1.2 * texture (sampler_main, tmpvar_8).xyz) + (0.15 * \n    ((texture (sampler_blur1, tmpvar_8).xyz * scale1) + bias1)\n  )));\n  ret_1 = (ret_1 + 1.0);\n  float tmpvar_9;\n  tmpvar_9 = dot (ret_1, vec3(0.32, 0.49, 0.29));\n  ret_1 = (mix (vec3(tmpvar_9), (\n    (0.75 * vec3(tmpvar_9))\n   * \n    dot ((((0.6 * \n      ((texture (sampler_blur3, tmpvar_6).xyz * scale3) + bias3)\n    ) - (0.7 * texture (sampler_main, uv).xyz)) - (0.3 * (\n      (texture (sampler_blur1, tmpvar_8).xyz * scale1)\n     + bias1))), vec3(0.32, 0.49, 0.29))\n  ), pow (hue_shader, vec3(tmpvar_9))) * 0.9);\n  ret_1 = (ret_1 * ret_1);\n  vec3 tmpvar_10;\n  tmpvar_10 = sqrt(ret_1);\n  ret_1 = tmpvar_10;\n  vec4 tmpvar_11;\n  tmpvar_11.w = 1.0;\n  tmpvar_11.xyz = tmpvar_10;\n  ret = tmpvar_11.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.d=0;a.cx1=0;a.y3=0;a.y1=0;a.cy1=0;a.x1=0;a.vx3=0;a.q6=0;a.dt=0;a.q1=0;a.q5=0;a.v=0;a.vx4=0;a.grav=0;a.x3=0;a.xx2=0;a.q4=0;a.yy1=0;a.vy4=0;a.dir=0;a.bounce=0;a.x4=0;a.r=0;a.x2=0;a.vy2=0;a.y2=0;a.q2=0;a.spring=0;a.vx2=0;a.q3=0;a.resist=0;a.y4=0;a.q7=0;a.vy3=0;a.xx1=0;a.q8=0;
return a;},frame_eqs:function(a){
a.decay=1;a.xx1=.9*a.xx1+.01*a.bass;a.xx2=.9*a.xx2+.01*a.treb;a.yy1=.94*a.yy1+.0075*(a.treb+a.bass);a.x1=.5+1.5*(a.xx1-a.xx2);a.y1=.5+a.yy1;a.spring=18;a.grav=1;a.resist=5;a.bounce=.9;a.dt=.0003;a.vx2=a.vx2*(1-a.resist*a.dt)+a.dt*(a.x1+a.x3-2*a.x2)*a.spring;a.vy2=a.vy2*(1-a.resist*a.dt)+a.dt*((a.y1+a.y3-2*a.y2)*a.spring-a.grav);a.vx3=a.vx3*(1-a.resist*a.dt)+a.dt*(a.x2+a.x4-2*a.x3)*a.spring;a.vy3=a.vy3*(1-a.resist*a.dt)+a.dt*((a.y2+a.y4-2*a.y3)*a.spring-a.grav);a.vx4=a.vx4*(1-
a.resist*a.dt)+a.dt*(a.x3-a.x4)*a.spring;a.vy4=a.vy4*(1-a.resist*a.dt)+a.dt*((a.y3-a.y4)*a.spring-a.grav);a.x2+=a.vx2;a.y2+=a.vy2;a.x3+=a.vx3;a.y3+=a.vy3;a.x4+=a.vx4;a.y4+=a.vy4;a.vx2=.00001<Math.abs(above(a.x2,0))?a.vx2:Math.abs(a.vx2)*a.bounce;a.vx2=.00001<Math.abs(below(a.x2,1))?a.vx2:-Math.abs(a.vx2)*a.bounce;a.vx3=.00001<Math.abs(above(a.x3,0))?a.vx3:Math.abs(a.vx3)*a.bounce;a.vx3=.00001<Math.abs(below(a.x3,1))?a.vx3:-Math.abs(a.vx3)*a.bounce;a.vx4=.00001<Math.abs(above(a.x4,0))?a.vx4:Math.abs(a.vx4)*
a.bounce;a.vx4=.00001<Math.abs(below(a.x4,1))?a.vx4:-Math.abs(a.vx4)*a.bounce;a.vy2=.00001<Math.abs(above(a.y2,0))?a.vy2:Math.abs(a.vy2)*a.bounce;a.vy2=.00001<Math.abs(below(a.y2,1))?a.vy2:-Math.abs(a.vy2)*a.bounce;a.vy3=.00001<Math.abs(above(a.y3,0))?a.vy3:Math.abs(a.vy3)*a.bounce;a.vy3=.00001<Math.abs(below(a.y3,1))?a.vy3:-Math.abs(a.vy3)*a.bounce;a.vy4=.00001<Math.abs(above(a.y4,0))?a.vy4:Math.abs(a.vy4)*a.bounce;a.vy4=.00001<Math.abs(below(a.y4,1))?a.vy4:-Math.abs(a.vy4)*a.bounce;a.q1=a.x1;a.q2=
a.x2;a.q3=a.x3;a.q4=a.x4;a.q5=a.y1;a.q6=a.y2;a.q7=a.y3;a.q8=a.y4;a.q6=Math.atan2(a.vx4,a.vy4);a.q5=sqrt(a.vx4*a.vx4+a.vy4*a.vy4);a.zoom=1.001;a.rot=0;a.warp=.2;a.wave_a=0;
return a;},pixel_eqs:function(a){
a.r=.2;a.cx1=a.q4;a.cy1=a.q5;a.d=sqrt((a.x-a.cx1)*(a.x-a.cx1)+(a.y-a.cy1)*(a.y-a.cy1));a.dir=-(a.r*a.r-a.d*a.d)*a.q3;a.x1=.00001<Math.abs(above(a.d,a.r))?0:Math.sin(a.y-a.cy1)*a.dir;a.y1=.00001<Math.abs(above(a.d,a.r))?0:-Math.sin(a.x-a.cx1)*a.dir;a.v=1;a.dx=a.x1*a.v;a.dy=a.y1*a.v;
return a;}}),
"Flexi - area 51":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1,"decay":0.995,"echo_zoom":1.007,"echo_orient":3,"wave_thick":1,"modwavealphabyvolume":1,"wave_a":0.9,"wave_scale":2.997,"wave_smoothing":0,"wave_mystery":-0.5,"modwavealphastart":1,"modwavealphaend":1,"warpanimspeed":0.274,"warpscale":7.98,"zoom":0.99951,"warp":0.20929,"wave_r":0.02,"wave_g":0.02,"wave_b":0,"ob_size":0.5,"ob_r":1,"ob_g":0.12,"ob_b":1,"ob_a":0.37,"ib_size":0,"ib_a":1,"mv_x":0,"mv_y":0,"mv_l":5,"mv_a":0,"b1ed":0.2},"warp":" shader_body { \n  vec2 my_uv2_1;\n  vec2 dz_2;\n  vec3 ret_3;\n  vec2 tmpvar_4;\n  tmpvar_4 = (texsize.zw * 4.0);\n  vec3 tmpvar_5;\n  tmpvar_5 = ((2.0 * (\n    (texture (sampler_blur1, (uv + (vec2(1.0, 0.0) * tmpvar_4))).xyz * scale1)\n   + bias1)) - (2.0 * (\n    (texture (sampler_blur1, (uv - (vec2(1.0, 0.0) * tmpvar_4))).xyz * scale1)\n   + bias1)));\n  vec3 tmpvar_6;\n  tmpvar_6 = ((2.0 * (\n    (texture (sampler_blur1, (uv + (vec2(0.0, 1.0) * tmpvar_4))).xyz * scale1)\n   + bias1)) - (2.0 * (\n    (texture (sampler_blur1, (uv - (vec2(0.0, 1.0) * tmpvar_4))).xyz * scale1)\n   + bias1)));\n  vec2 tmpvar_7;\n  tmpvar_7.x = tmpvar_5.x;\n  tmpvar_7.y = tmpvar_6.x;\n  vec2 tmpvar_8;\n  tmpvar_8 = (tmpvar_7 * texsize.zw);\n  ret_3.x = (texture (sampler_fw_main, (uv - tmpvar_8)).x - ((\n    (texture (sampler_blur3, uv).xyz * scale3)\n   + bias3).x - (\n    (texture (sampler_blur1, (uv + tmpvar_8)).xyz * scale1)\n   + bias1).x));\n  vec2 tmpvar_9;\n  tmpvar_9.x = tmpvar_5.y;\n  tmpvar_9.y = tmpvar_6.y;\n  dz_2 = (-(tmpvar_9) * texsize.zw);\n  ret_3.y = ((texture (sampler_fw_main, (uv - dz_2)).y - 0.06) - ((\n    ((texture (sampler_blur2, uv).xyz * scale2) + bias2)\n  .y - \n    ((texture (sampler_blur1, (uv + dz_2)).xyz * scale1) + bias1)\n  .y) * 1.3));\n  vec2 tmpvar_10;\n  tmpvar_10 = ((uv_orig - 0.5) * (1.8 - (\n    (bass_att - treb_att)\n   * 0.015)));\n  vec2 tmpvar_11;\n  tmpvar_11.x = ((tmpvar_10.x * tmpvar_10.x) - (tmpvar_10.y * tmpvar_10.y));\n  tmpvar_11.y = ((2.0 * tmpvar_10.x) * tmpvar_10.y);\n  my_uv2_1 = (tmpvar_11 + vec2(0.28, 0.4));\n  vec2 tmpvar_12;\n  tmpvar_12.x = ((2.0 * (\n    (texture (sampler_blur1, (my_uv2_1 + (vec2(1.0, 0.0) * tmpvar_4))).xyz * scale1)\n   + bias1)) - (2.0 * (\n    (texture (sampler_blur1, (my_uv2_1 - (vec2(1.0, 0.0) * tmpvar_4))).xyz * scale1)\n   + bias1))).z;\n  tmpvar_12.y = ((2.0 * (\n    (texture (sampler_blur1, (my_uv2_1 + (vec2(0.0, 1.0) * tmpvar_4))).xyz * scale1)\n   + bias1)) - (2.0 * (\n    (texture (sampler_blur1, (my_uv2_1 - (vec2(0.0, 1.0) * tmpvar_4))).xyz * scale1)\n   + bias1))).z;\n  dz_2 = (tmpvar_12 * texsize.zw);\n  ret_3.z = (texture (sampler_main, clamp ((my_uv2_1 + dz_2), 0.0, 1.0)).z - 0.014);\n  vec4 tmpvar_13;\n  tmpvar_13.w = 1.0;\n  tmpvar_13.xyz = ret_3;\n  ret = tmpvar_13.xyz;\n }","comp":" shader_body { \n  vec3 dy_1;\n  vec3 dx_2;\n  vec2 mirror_uv_3;\n  vec3 ret_4;\n  vec2 tmpvar_5;\n  tmpvar_5 = ((uv - 0.5) * aspect.xy);\n  vec2 tmpvar_6;\n  tmpvar_6.x = ((q4 * tmpvar_5.x) - (q3 * tmpvar_5.y));\n  tmpvar_6.y = ((q3 * tmpvar_5.x) + (q4 * tmpvar_5.y));\n  vec2 tmpvar_7;\n  tmpvar_7 = (0.5 - (tmpvar_6 * 2.0));\n  vec2 numerator_8;\n  numerator_8 = (tmpvar_7 - vec2(0.0, 0.5));\n  vec2 denominator_9;\n  denominator_9 = (tmpvar_7 - vec2(1.0, 0.5));\n  vec2 tmpvar_10;\n  tmpvar_10.x = ((numerator_8.x * denominator_9.x) + (numerator_8.y * denominator_9.y));\n  tmpvar_10.y = ((numerator_8.y * denominator_9.x) - (numerator_8.x * denominator_9.y));\n  vec2 tmpvar_11;\n  tmpvar_11 = (((tmpvar_10 / \n    ((denominator_9.x * denominator_9.x) + (denominator_9.y * denominator_9.y))\n  ) + 0.5) - vec2(0.5, 0.5));\n  float tmpvar_12;\n  tmpvar_12 = sqrt(dot (tmpvar_11, tmpvar_11));\n  float tmpvar_13;\n  float tmpvar_14;\n  tmpvar_14 = (min (abs(\n    (tmpvar_11.x / tmpvar_11.y)\n  ), 1.0) / max (abs(\n    (tmpvar_11.x / tmpvar_11.y)\n  ), 1.0));\n  float tmpvar_15;\n  tmpvar_15 = (tmpvar_14 * tmpvar_14);\n  tmpvar_15 = (((\n    ((((\n      ((((-0.01213232 * tmpvar_15) + 0.05368138) * tmpvar_15) - 0.1173503)\n     * tmpvar_15) + 0.1938925) * tmpvar_15) - 0.3326756)\n   * tmpvar_15) + 0.9999793) * tmpvar_14);\n  tmpvar_15 = (tmpvar_15 + (float(\n    (abs((tmpvar_11.x / tmpvar_11.y)) > 1.0)\n  ) * (\n    (tmpvar_15 * -2.0)\n   + 1.570796)));\n  tmpvar_13 = (tmpvar_15 * sign((tmpvar_11.x / tmpvar_11.y)));\n  if ((abs(tmpvar_11.y) > (1e-08 * abs(tmpvar_11.x)))) {\n    if ((tmpvar_11.y < 0.0)) {\n      if ((tmpvar_11.x >= 0.0)) {\n        tmpvar_13 += 3.141593;\n      } else {\n        tmpvar_13 = (tmpvar_13 - 3.141593);\n      };\n    };\n  } else {\n    tmpvar_13 = (sign(tmpvar_11.x) * 1.570796);\n  };\n  vec2 tmpvar_16;\n  tmpvar_16.x = (tmpvar_13 * 0.1591549);\n  tmpvar_16.y = tmpvar_12;\n  vec2 tmpvar_17;\n  tmpvar_17.x = ((tmpvar_16.x * 2.0) + q11);\n  tmpvar_17.y = ((0.3 * log(tmpvar_12)) + q12);\n  vec2 tmpvar_18;\n  tmpvar_18 = (0.5 + (0.5 - abs(\n    ((fract((tmpvar_17 * 0.5)) * 2.0) - 1.0)\n  )));\n  vec2 tmpvar_19;\n  tmpvar_19 = (texsize.zw * 3.0);\n  vec3 tmpvar_20;\n  tmpvar_20 = ((2.0 * (\n    (texture (sampler_blur1, (tmpvar_18 + (vec2(1.0, 0.0) * tmpvar_19))).xyz * scale1)\n   + bias1)) - (2.0 * (\n    (texture (sampler_blur1, (tmpvar_18 - (vec2(1.0, 0.0) * tmpvar_19))).xyz * scale1)\n   + bias1)));\n  vec3 tmpvar_21;\n  tmpvar_21 = ((2.0 * (\n    (texture (sampler_blur1, (tmpvar_18 + (vec2(0.0, 1.0) * tmpvar_19))).xyz * scale1)\n   + bias1)) - (2.0 * (\n    (texture (sampler_blur1, (tmpvar_18 - (vec2(0.0, 1.0) * tmpvar_19))).xyz * scale1)\n   + bias1)));\n  vec2 tmpvar_22;\n  tmpvar_22.x = tmpvar_20.x;\n  tmpvar_22.y = tmpvar_21.x;\n  mirror_uv_3 = (tmpvar_18 + ((tmpvar_22 * texsize.zw) * 4.0));\n  ret_4 = ((mix (ret_4, vec3(1.0, 1.0, 1.0), \n    ((((texture (sampler_blur1, mirror_uv_3).xyz * scale1) + bias1).x * (1.0 - (\n      (texture (sampler_blur2, mirror_uv_3).xyz * scale2)\n     + bias2).x)) * (pow (hue_shader, vec3(4.0, 4.0, 4.0)) * 1.4))\n  ) * texture (sampler_main, mirror_uv_3).xxx) + ((\n    (1.0 - texture (sampler_main, mirror_uv_3).x)\n   * \n    ((texture (sampler_blur1, mirror_uv_3).xyz * scale1) + bias1)\n  .x) * vec3(3.0, 3.0, 3.0)));\n  vec2 tmpvar_23;\n  tmpvar_23.x = tmpvar_20.x;\n  tmpvar_23.y = tmpvar_21.x;\n  mirror_uv_3 = (mirror_uv_3 - ((tmpvar_23 * texsize.zw) * 24.0));\n  dx_2 = ((2.0 * (\n    (texture (sampler_blur1, (mirror_uv_3 + (vec2(1.0, 0.0) * tmpvar_19))).xyz * scale1)\n   + bias1)) - (2.0 * (\n    (texture (sampler_blur1, (mirror_uv_3 - (vec2(1.0, 0.0) * tmpvar_19))).xyz * scale1)\n   + bias1)));\n  dy_1 = ((2.0 * (\n    (texture (sampler_blur1, (mirror_uv_3 + (vec2(0.0, 1.0) * tmpvar_19))).xyz * scale1)\n   + bias1)) - (2.0 * (\n    (texture (sampler_blur1, (mirror_uv_3 - (vec2(0.0, 1.0) * tmpvar_19))).xyz * scale1)\n   + bias1)));\n  vec2 tmpvar_24;\n  tmpvar_24.x = -(dx_2.y);\n  tmpvar_24.y = dy_1.y;\n  vec2 tmpvar_25;\n  tmpvar_25 = (tmpvar_24 * 0.25);\n  vec3 tmpvar_26;\n  tmpvar_26 = mix (ret_4, vec3(1.0, 1.0, 1.0), (mix (vec3(1.0, 0.7, 0.2), vec3(0.15, 0.0, 0.5), vec3(\n    ((((\n      ((mirror_uv_3.x * 0.8) - mirror_uv_3.y)\n     + 0.75) + tmpvar_25.x) + tmpvar_25.y) - 0.1)\n  )) * texture (sampler_main, mirror_uv_3).y));\n  vec2 tmpvar_27;\n  vec2 tmpvar_28;\n  tmpvar_28 = ((0.5 + (\n    (uv - 0.5)\n   * aspect.wz)) - vec2(0.5, 0.5));\n  vec2 tmpvar_29;\n  tmpvar_29.x = ((q4 * tmpvar_28.x) - (q3 * tmpvar_28.y));\n  tmpvar_29.y = ((q3 * tmpvar_28.x) + (q4 * tmpvar_28.y));\n  tmpvar_27 = (vec2(0.5, 0.5) + tmpvar_29);\n  mirror_uv_3 = tmpvar_27.yx;\n  vec2 tmpvar_30;\n  tmpvar_30 = (vec2(1.0, 0.0) * texsize.zw);\n  dx_2 = ((2.0 * texture (sampler_main, (tmpvar_27.yx + tmpvar_30)).xyz) - (2.0 * texture (sampler_main, (tmpvar_27.yx - tmpvar_30)).xyz));\n  vec2 tmpvar_31;\n  tmpvar_31 = (vec2(0.0, 1.0) * texsize.zw);\n  dy_1 = ((2.0 * texture (sampler_main, (tmpvar_27.yx + tmpvar_31)).xyz) - (2.0 * texture (sampler_main, (tmpvar_27.yx - tmpvar_31)).xyz));\n  vec2 tmpvar_32;\n  tmpvar_32.x = dx_2.z;\n  tmpvar_32.y = dy_1.z;\n  vec3 tmpvar_33;\n  tmpvar_33 = mix (tmpvar_26, vec3(0.9, 0.9, 1.0), vec3((1.0 - texture (sampler_main, (tmpvar_27.yx - tmpvar_32)).z)));\n  ret_4 = tmpvar_33;\n  vec4 tmpvar_34;\n  tmpvar_34.w = 1.0;\n  tmpvar_34.xyz = tmpvar_33;\n  ret = tmpvar_34.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.d=0;a.w=0;a.h3=0;a.q12=0;a.q6=0;a.bt=0;a.q1=0;a.q5=0;a.startx=0;a.v=0;a.mm=0;a.h2=0;a.tt=0;a.bm=0;a.q11=0;a.q10=0;a.q4=0;a.a=0;a.mt=0;a.b=0;a.mx=0;a.mn=0;a.bb=0;a.q2=0;a.starty=0;a.h1=0;a.q3=0;a.q7=0;a.x1=0;a.y1=.001;a.z1=0;
return a;},frame_eqs:function(a){
a.zoom=1;a.wave_a=0;a.startx=.3;a.starty=.3;a.a=.55;a.b=.05;a.d=.09;a.q1=a.aspectx;a.q2=a.aspecty;a.q5=a.a;a.q6=a.b;a.q7=a.d;a.bb=.99*a.bb+.02*a.bass;a.mm=.99*a.mm+.02*a.mid;a.tt=.99*a.tt+.02*a.treb;a.mx=Math.max(Math.max(a.bb,a.mm),a.tt);a.mn=Math.min(Math.min(a.bb,a.mm),a.tt);a.h1=div(a.bb-a.mn,a.mx-a.mn);a.h2=div(a.mm-a.mn,a.mx-a.mn);a.h3=div(a.tt-a.mn,a.mx-a.mn);a.v=div(.1333,a.fps);a.bm+=(a.h1-a.h2)*a.v;a.mt+=(a.h2-a.h3)*a.v;a.bt+=(a.h1-a.h3)*a.v;a.w=2*a.bm;a.q3=Math.sin(a.w);
a.q4=Math.cos(a.w);a.q10=a.bm;a.q11=a.mt;a.q12=a.bt;
return a;},pixel_eqs:function(a){
a.x=.5+(a.x-.51)*a.q1;a.y=.5-(a.y-.5)*a.q2;a.dx=a.x*(1-a.x)-div(a.q5*a.x*a.y,a.x+a.q6);a.dy=-a.q7*a.y*(1-div(a.y,a.x));a.dx=div(.02*-a.dx,a.q1);a.dy=div(.02*-a.dy,a.q2);
return a;}}),
"flexi - hyperspaceflight (bn cn Jelly 4)":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1,"decay":1,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_a":0.107,"wave_scale":1.119,"wave_smoothing":0,"modwavealphastart":1.2,"modwavealphaend":1.2,"zoomexp":1.4166,"zoom":1.14635,"warp":0.01605,"wave_r":0,"wave_g":0.93,"ob_size":0.005,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0,"b1ed":0},"pixel_eqs":"","warp":" shader_body { \n  vec3 ret_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = (texsize.zw * 10.0);\n  vec2 tmpvar_3;\n  tmpvar_3.x = (((texture (sampler_blur1, \n    (uv + (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1)).x;\n  tmpvar_3.y = (((texture (sampler_blur1, \n    (uv + (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1)).x;\n  vec2 tmpvar_4;\n  tmpvar_4 = (mix (uv_orig, uv, vec2(0.4, 0.4)) + ((tmpvar_3 * texsize.zw) * 2.0));\n  ret_1.x = ((texture (sampler_main, tmpvar_4).x - (\n    (texture (sampler_main, tmpvar_4).x - ((texture (sampler_blur3, tmpvar_4).xyz * scale3) + bias3).x)\n   * 0.02)) - 0.008);\n  ret_1.y = texture (sampler_main, uv).y;\n  ret_1.y = (ret_1.y + ((\n    (ret_1.y - ((texture (sampler_blur1, uv).xyz * scale1) + bias1).y)\n   * 0.2) - 0.004));\n  ret_1.z = (texture (sampler_main, ((uv_orig - \n    ((uv_orig - uv) * 2.0)\n  ) + (\n    (texture (sampler_noise_lq, (((uv_orig * texsize.xy) * texsize_noise_lq.zw) + rand_frame.xy)).xyz - 0.5)\n  .xy * texsize.zw))).z - 0.004);\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = ret_1;\n  ret = tmpvar_5.xyz;\n }","comp":" shader_body { \n  vec3 ret2_1;\n  vec3 ret_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = (texsize.zw * 6.0);\n  vec2 tmpvar_4;\n  tmpvar_4.x = dot (((\n    (texture (sampler_blur1, (uv + (vec2(1.0, 0.0) * tmpvar_3))).xyz * scale1)\n   + bias1) - (\n    (texture (sampler_blur1, (uv - (vec2(1.0, 0.0) * tmpvar_3))).xyz * scale1)\n   + bias1)), vec3(0.32, 0.49, 0.29));\n  tmpvar_4.y = dot (((\n    (texture (sampler_blur1, (uv + (vec2(0.0, 1.0) * tmpvar_3))).xyz * scale1)\n   + bias1) - (\n    (texture (sampler_blur1, (uv - (vec2(0.0, 1.0) * tmpvar_3))).xyz * scale1)\n   + bias1)), vec3(0.32, 0.49, 0.29));\n  vec2 tmpvar_5;\n  tmpvar_5 = (uv - (0.25 * tmpvar_4));\n  vec4 tmpvar_6;\n  tmpvar_6 = texture (sampler_blur3, uv);\n  ret_2 = (0.3 * ((tmpvar_6.xyz * scale3) + bias3));\n  ret_2 = (ret_2 - ((\n    (texture (sampler_blur2, uv).xyz * scale2)\n   + bias2) - 0.01));\n  vec4 tmpvar_7;\n  tmpvar_7 = texture (sampler_blur1, uv);\n  ret_2 = (ret_2 + ((texture (sampler_main, uv).xyz + \n    (((tmpvar_7.xyz * scale1) + bias1) * 0.15)\n  ) - 0.01));\n  ret_2 = (ret_2 + 0.75);\n  float tmpvar_8;\n  tmpvar_8 = dot (ret_2, vec3(0.32, 0.49, 0.29));\n  vec3 tmpvar_9;\n  tmpvar_9 = mix (vec3(tmpvar_8), (vec3(tmpvar_8) * dot (\n    ((0.8 * ((texture (sampler_blur3, tmpvar_5).xyz * scale3) + bias3)) - ((texture (sampler_blur1, tmpvar_5).xyz * scale1) + bias1))\n  , vec3(0.32, 0.49, 0.29))), pow (hue_shader, vec3(tmpvar_8)));\n  ret2_1 = ((-0.3 * (\n    (texture (sampler_blur3, tmpvar_5).xyz * scale3)\n   + bias3)) + ((texture (sampler_blur1, tmpvar_5).xyz * scale1) + bias1));\n  ret2_1 = (ret2_1 - texture (sampler_main, tmpvar_5).xyz);\n  ret2_1 = (ret2_1 - 0.75);\n  float tmpvar_10;\n  tmpvar_10 = dot (ret2_1, vec3(0.32, 0.49, 0.29));\n  vec3 tmpvar_11;\n  tmpvar_11 = mix (vec3(tmpvar_10), (vec3(tmpvar_10) * dot (\n    ((0.8 * ((tmpvar_6.xyz * scale3) + bias3)) - ((tmpvar_7.xyz * scale1) + bias1))\n  , vec3(0.32, 0.49, 0.29))), pow (hue_shader.zxy, tmpvar_9));\n  ret2_1 = tmpvar_11;\n  vec3 tmpvar_12;\n  tmpvar_12 = abs((tmpvar_9 - (2.0 * tmpvar_11)));\n  ret_2 = (tmpvar_12 - (0.175 * sqrt(tmpvar_12)));\n  ret_2 = (ret_2 * ret_2);\n  vec4 tmpvar_13;\n  tmpvar_13.w = 1.0;\n  tmpvar_13.xyz = ret_2;\n  ret = tmpvar_13.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":24,"additive":1,"num_inst":8,"x":0.48,"rad":0.0261,"tex_zoom":4.36077,"r2":1,"g2":0,"a2":1,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=div(randint(1E3),1E3);a.y=div(randint(1E3),1E3);a.ang=div(randint(150),100);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.q25=0;a.q29=0;a.q31=0;a.q23=0;a.q24=0;a.q26=0;a.q27=0;a.q32=0;a.q28=0;a.q30=0;
return a;},frame_eqs:function(a){
a.zoom=.935*a.zoom+.04*(.6*Math.sin(.339*a.bass_att)+.1*Math.sin(.276*a.bass_att));a.rot+=.04*(.6*Math.sin(.381*a.time)+.4*Math.sin(.579*a.time));a.cx+=.003*(.6*Math.sin(.471*a.treb_att)+.4*Math.sin(.297*a.treb_att));a.cy+=.003*(.6*Math.sin(.379*a.mid_att)+.4*Math.sin(.351*a.mid_att));a.dx+=.003*(.6*Math.sin(.234*a.time)+.4*Math.sin(.277*a.time));a.rot+=.02*(Math.sin(2.134*a.time)+Math.sin(1.7134*a.time)+Math.sin(2.834*a.time));a.dx+=.01*(Math.sin(1.134*a.time)+Math.sin(.7134*
a.time)+Math.sin(2.334*a.time));a.dy+=.01*(Math.sin(1.8834*a.time)+Math.sin(1.0144*a.time)+Math.sin(1.334*a.time));a.q23=div(randint(1E3),1E3);a.q24=div(randint(1E3),1E3);a.q25=6.28*div(randint(1E3),1E3);a.q26=a.q25-3.14;a.q27=div(randint(1E3),12E3)+.1;a.q28=div(randint(1E3),1E3);a.q29=div(randint(1E3),1E3);a.q30=6.28*div(randint(1E3),1E3);a.q31=a.q30-3.14;a.q32=div(randint(1E3),14E3)+.1;
return a;},pixel_eqs:''}),
"flexi - jelly fish mandala":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1,"decay":0.5,"echo_zoom":1,"echo_orient":3,"wave_thick":1,"modwavealphabyvolume":1,"wave_a":0.009,"wave_scale":1.554,"wave_smoothing":0.756,"modwavealphastart":1.2,"modwavealphaend":1.2,"warpanimspeed":0.01,"warpscale":100,"zoomexp":0.26311,"warp":0.01359,"wave_r":0,"wave_b":0,"ob_size":0,"ob_a":1,"ib_size":0.5,"ib_r":1,"ib_g":1,"ib_b":1,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0},"warp":" shader_body { \n  vec2 uv_z_1;\n  vec3 ret_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = (1.0 - abs((\n    (fract((uv * 0.5)) * 2.0)\n   - 1.0)));\n  ret_2.x = (texture (sampler_fc_main, tmpvar_3).y * 0.65);\n  vec2 tmpvar_4;\n  tmpvar_4 = (texsize.zw * 6.0);\n  vec2 tmpvar_5;\n  vec2 tmpvar_6;\n  tmpvar_6 = (uv_orig - 0.5);\n  tmpvar_5 = ((tmpvar_6 * 0.996) + 0.5);\n  vec2 tmpvar_7;\n  tmpvar_7.x = (((texture (sampler_blur1, \n    (tmpvar_5 + (vec2(1.0, 0.0) * tmpvar_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (tmpvar_5 - (vec2(1.0, 0.0) * tmpvar_4))\n  ).xyz * scale1) + bias1)).z;\n  tmpvar_7.y = (((texture (sampler_blur1, \n    (tmpvar_5 + (vec2(0.0, 1.0) * tmpvar_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (tmpvar_5 - (vec2(0.0, 1.0) * tmpvar_4))\n  ).xyz * scale1) + bias1)).z;\n  uv_z_1 = (tmpvar_5 - ((tmpvar_7 * texsize.zw) * 2.0));\n  ret_2.z = max (((\n    (texture (sampler_fc_main, tmpvar_3).x - 0.5)\n   * 3.0) * clamp (\n    (1.0 - (sqrt(dot (tmpvar_6, tmpvar_6)) * 3.2))\n  , 0.0, 1.0)), texture (sampler_fc_main, uv_z_1).z);\n  ret_2.z = (ret_2.z + ((texture (sampler_fc_main, uv_z_1).z - \n    ((texture (sampler_blur1, clamp (uv_z_1, 0.0, 1.0)).xyz * scale1) + bias1)\n  .z) * 0.02));\n  ret_2.y = (max (texture (sampler_fc_main, mix (uv, uv_orig, vec2(1.0001, 1.0001))).y, texture (sampler_fc_main, uv_orig).z) - 0.008);\n  ret_2.z = (ret_2.z * (1.0 + (ret_2.y * 0.024)));\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_2;\n  ret = tmpvar_8.xyz;\n }","comp":" shader_body { \n  vec2 uv_1;\n  float ang2_2;\n  ang2_2 = (fract((0.9549295 * ang)) / 6.0);\n  ang2_2 = (abs((ang2_2 - 0.08333334)) * 6.283185);\n  vec2 tmpvar_3;\n  tmpvar_3.x = cos(ang2_2);\n  tmpvar_3.y = sin(ang2_2);\n  uv_1 = (0.5 + ((\n    (0.4 * (rad * sqrt(dot (texsize.xy, texsize.xy))))\n   * tmpvar_3) * texsize.zw));\n  vec2 tmpvar_4;\n  tmpvar_4.x = cos((uv_1.y * 100.0));\n  tmpvar_4.y = sin((uv_1.x * 120.0));\n  uv_1 = (uv_1 + (0.02 * tmpvar_4));\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = (1.4 * pow ((\n    clamp (((texture (sampler_blur1, uv_1).xyz * scale1) + bias1), 0.0, 1.0)\n   * \n    (texture (sampler_fc_main, uv_1).xyz - ((texture (sampler_blur3, uv_1).xyz * scale3) + bias3))\n  ), vec3(0.5, 0.5, 0.5)));\n  ret = tmpvar_5.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":100,"additive":1,"thickoutline":1,"rad":0.86644,"r":0.85,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.d=0;a.xx=0;a.w=0;a.cz=0;a.my=0;a.vx=0;a.vy=0;a.mx=0;a.yy=0;
return a;},frame_eqs:function(a){
a.wave_a=.01;
return a;},pixel_eqs:function(a){
a.vx=.5+.5*Math.cos(.2*a.time);a.vy=.5+.5*Math.sin(.2*a.time);a.x-=a.vx;a.y-=a.vy;a.d=.04*a.time;a.xx=Math.sin(a.d)*a.x+Math.cos(a.d)*a.y;a.yy=Math.cos(a.d)*a.x-Math.sin(a.d)*a.y;a.x=a.xx;a.y=a.yy;a.cz=.5;a.zoom=.33;a.w=div(1,a.zoom)*(1+sqrt(sqr(a.cz)+sqr(a.x-a.cx)+sqr(a.y-a.cy)));a.dx=(a.x-a.mx)*a.w;a.dy=(a.y-a.my)*a.w;
return a;}}),
"Flexi - mindblob [shiny mix]":()=>Object.assign({"baseVals":{"rating":1,"gammaadj":1,"decay":1,"echo_zoom":1,"echo_alpha":0.5,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"wave_a":2.789,"wave_scale":0.292,"wave_smoothing":0,"wave_mystery":0.12,"modwavealphastart":1,"modwavealphaend":1,"warpanimspeed":0.01,"warpscale":100,"zoomexp":0.92178,"zoom":0.9901,"warp":0.01,"wave_g":0,"ob_size":0,"ob_r":0.2,"ob_a":0.1,"ib_size":0,"ib_r":0,"ib_g":0,"ib_b":0,"ib_a":1,"mv_x":64,"mv_y":48,"mv_l":0,"mv_b":0,"mv_a":0,"b1ed":0},"warp":" shader_body { \n  vec3 ret_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = (texsize.zw * 8.0);\n  vec2 tmpvar_3;\n  tmpvar_3.x = (((texture (sampler_blur1, \n    (uv + (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1)).x;\n  tmpvar_3.y = (((texture (sampler_blur1, \n    (uv + (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1)).x;\n  vec2 tmpvar_4;\n  tmpvar_4 = (uv - ((tmpvar_3 * texsize.zw) * 0.5));\n  ret_1.x = texture (sampler_fw_main, tmpvar_4).x;\n  ret_1.x = (ret_1.x + ((\n    (ret_1.x - ((texture (sampler_blur3, tmpvar_4).xyz * scale3) + bias3).x)\n   * 0.2) - 0.004));\n  ret_1.y = ((texture (sampler_fw_main, uv_orig).y * 0.98) - 0.004);\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = ret_1;\n  ret = tmpvar_5.xyz;\n }","comp":" shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1 = (texsize.zw * 4.0);\n  vec2 tmpvar_2;\n  tmpvar_2.x = (((texture (sampler_blur1, \n    (uv + (vec2(1.0, 0.0) * tmpvar_1))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(1.0, 0.0) * tmpvar_1))\n  ).xyz * scale1) + bias1)).x;\n  tmpvar_2.y = (((texture (sampler_blur1, \n    (uv + (vec2(0.0, 1.0) * tmpvar_1))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(0.0, 1.0) * tmpvar_1))\n  ).xyz * scale1) + bias1)).x;\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = mix ((vec3(0.0, 0.0, 1.0) * texture (sampler_main, uv).x), vec3(1.0, 0.0, 0.0), texture (sampler_main, (uv - tmpvar_2)).yyy);\n  ret = tmpvar_3.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":100,"additive":1,"thickoutline":1,"x":0.43,"y":0.42,"rad":0.15799,"ang":0.1885,"tex_zoom":0.87865,"r":0,"g":1,"g2":0,"border_a":0}},{init_eqs:function(a){
a.q4=0;a.q8=0;
return a;},frame_eqs:function(a){
a.x=a.q4;a.y=a.q8;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.y3=0;a.y1=0;a.xx=0;a.si3=0;a.t1=0;a.x1=0;a.vx3=0;a.q6=0;a.dt=0;a.q1=0;a.q5=0;a.d1=0;a.si1=0;a.vx4=0;a.grav=0;a.x3=0;a.d2=0;a.xx2=0;a.q4=0;a.yy1=0;a.vy4=0;a.dir=0;a.bounce=0;a.x4=0;a.x2=0;a.vy2=0;a.y2=0;a.q2=0;a.m1=0;a.spring=0;a.si2=0;a.vx2=0;a.q3=0;a.resist=0;a.yy=0;a.y4=0;a.q7=0;a.vy3=0;a.xx1=0;a.b1=0;a.q8=0;a.x1=.9;a.y1=.5;a.x2=.5;a.y2=.5;a.x3=.5;a.y3=.5;a.x4=.5;a.y4=.5;
return a;},frame_eqs:function(a){
a.decay=1;a.xx1=.9*a.xx1+.01*a.bass;a.xx2=.9*a.xx2+.01*a.treb;a.yy1=.94*a.yy1+.0075*(a.treb+a.bass);a.x1=.5+a.xx1-a.xx2;a.y1=.5+a.yy1;a.spring=18;a.grav=1;a.resist=.2;a.bounce=.9;a.dt=.0003;a.vx2=a.vx2*(1-a.resist*a.dt)+a.dt*(a.x1+a.x3-2*a.x2)*a.spring;a.vy2=a.vy2*(1-a.resist*a.dt)+a.dt*((a.y1+a.y3-2*a.y2)*a.spring-a.grav);a.vx3=a.vx3*(1-a.resist*a.dt)+a.dt*(a.x2+a.x4-2*a.x3)*a.spring;a.vy3=a.vy3*(1-a.resist*a.dt)+a.dt*((a.y2+a.y4-2*a.y3)*a.spring-a.grav);a.vx4=a.vx4*(1-a.resist*
a.dt)+a.dt*(a.x3-a.x4)*a.spring;a.vy4=a.vy4*(1-a.resist*a.dt)+a.dt*((a.y3-a.y4)*a.spring-a.grav);a.x2+=a.vx2;a.y2+=a.vy2;a.x3+=a.vx3;a.y3+=a.vy3;a.x4+=a.vx4;a.y4+=a.vy4;a.vx2=.00001<Math.abs(above(a.x2,0))?a.vx2:Math.abs(a.vx2)*a.bounce;a.vx2=.00001<Math.abs(below(a.x2,1))?a.vx2:-Math.abs(a.vx2)*a.bounce;a.vx3=.00001<Math.abs(above(a.x3,0))?a.vx3:Math.abs(a.vx3)*a.bounce;a.vx3=.00001<Math.abs(below(a.x3,1))?a.vx3:-Math.abs(a.vx3)*a.bounce;a.vx4=.00001<Math.abs(above(a.x4,0))?a.vx4:Math.abs(a.vx4)*
a.bounce;a.vx4=.00001<Math.abs(below(a.x4,1))?a.vx4:-Math.abs(a.vx4)*a.bounce;a.vy2=.00001<Math.abs(above(a.y2,0))?a.vy2:Math.abs(a.vy2)*a.bounce;a.vy2=.00001<Math.abs(below(a.y2,1))?a.vy2:-Math.abs(a.vy2)*a.bounce;a.vy3=.00001<Math.abs(above(a.y3,0))?a.vy3:Math.abs(a.vy3)*a.bounce;a.vy3=.00001<Math.abs(below(a.y3,1))?a.vy3:-Math.abs(a.vy3)*a.bounce;a.vy4=.00001<Math.abs(above(a.y4,0))?a.vy4:Math.abs(a.vy4)*a.bounce;a.vy4=.00001<Math.abs(below(a.y4,1))?a.vy4:-Math.abs(a.vy4)*a.bounce;a.q1=a.x1;a.q2=
a.x2;a.q3=a.x3;a.q4=a.x4;a.q5=a.y1;a.q6=a.y2;a.q7=a.y3;a.q8=a.y4;a.zoom=1.004;a.q6=Math.atan2(a.vx4,a.vy4);a.q5=sqrt(a.vx4*a.vx4+a.vy4*a.vy4);
return a;},pixel_eqs:function(a){
a.dir=-a.q6+Math.asin(1);a.b1=.08;a.m1=45*a.q5;a.t1=.5;a.xx=.5+div(a.q4-.5,a.aspectx);a.yy=1-(.5+div(a.q8-.5,a.aspecty));a.x1=a.xx+Math.cos(a.dir+1.5708)*a.b1;a.y1=a.yy-Math.sin(a.dir+1.5708)*a.b1;a.x2=a.xx-Math.cos(a.dir+1.5708)*a.b1;a.y2=a.yy+Math.sin(a.dir+1.5708)*a.b1;a.d1=sqrt((a.x1-a.x)*(a.x1-a.x)+(a.y1-a.y)*(a.y1-a.y))-2*a.b1;a.si1=1-div(1,1+pow(2,100*-a.d1));a.d2=sqrt((a.x2-a.x)*(a.x2-a.x)+(a.y2-a.y)*(a.y2-a.y))-2*a.b1;a.si2=1-div(1,1+pow(2,100*-a.d2));a.si3=0*-pow(a.q5,
3);a.dx=div(2*(a.si1*Math.sin(a.y1-a.y)*a.m1*a.d1-a.si2*Math.sin(a.y2-a.y)*a.m1*a.d2+a.si3*Math.cos(a.dir)*a.t1),a.aspectx);a.dy=div(2*(-a.si1*Math.sin(a.x1-a.x)*a.m1*a.d1+a.si2*Math.sin(a.x2-a.x)*a.m1*a.d2-a.si3*Math.sin(a.dir)*a.t1),a.aspecty);
return a;}}),
"Flexi - mindblob mix":()=>Object.assign({"baseVals":{"rating":1,"gammaadj":1,"decay":1,"echo_zoom":1,"echo_alpha":0.5,"wave_thick":1,"wave_brighten":0,"wrap":0,"wave_a":0.004,"wave_scale":0.01,"wave_smoothing":0,"wave_mystery":-0.44,"modwavealphastart":1,"modwavealphaend":1,"warpanimspeed":0.137,"warpscale":13.125,"zoom":0.99951,"warp":0.99213,"wave_y":0.04,"ob_size":0.015,"ob_r":0.1,"ob_g":0.25,"ob_a":1,"ib_size":0,"ib_b":1,"mv_x":64,"mv_y":48,"mv_l":0,"mv_b":0,"mv_a":0},"pixel_eqs":"","warp":" shader_body { \n  vec2 uv_1;\n  vec2 my_uv_2;\n  vec3 ret_3;\n  vec2 tmpvar_4;\n  tmpvar_4.x = q4;\n  tmpvar_4.y = (1.0 - q8);\n  vec2 tmpvar_5;\n  tmpvar_5.x = -(q15);\n  tmpvar_5.y = q16;\n  vec2 domain_6;\n  vec2 uv_rot_7;\n  domain_6 = (uv - tmpvar_4);\n  domain_6 = (domain_6 * aspect.xy);\n  float tmpvar_8;\n  tmpvar_8 = (1.0/((1.0 + exp(\n    ((sqrt(dot (domain_6, domain_6)) - 0.07) * 50.0)\n  ))));\n  domain_6 = (domain_6 + ((tmpvar_5 * q13) * (aspect.wz * tmpvar_8)));\n  float tmpvar_9;\n  tmpvar_9 = sin(tmpvar_8);\n  float tmpvar_10;\n  tmpvar_10 = cos(tmpvar_8);\n  uv_rot_7.x = ((tmpvar_10 * domain_6.x) - (tmpvar_9 * domain_6.y));\n  uv_rot_7.y = ((tmpvar_9 * domain_6.x) + (tmpvar_10 * domain_6.y));\n  uv_rot_7 = (uv_rot_7 * aspect.zw);\n  uv_rot_7 = (uv_rot_7 + tmpvar_4);\n  uv_1 = (clamp ((tmpvar_4 + \n    ((uv_rot_7 - tmpvar_4) * mix (1.0, 4.0, tmpvar_8))\n  ), 0.0, 1.0) + (texsize.zw * vec2(0.0, 0.15)));\n  vec2 tmpvar_11;\n  tmpvar_11 = mix (uv_orig, uv_1, vec2(0.2, 0.2));\n  uv_1 = tmpvar_11;\n  vec2 tmpvar_12;\n  tmpvar_12 = (vec2(1280.0, 1024.0) * texsize.zw);\n  float tmpvar_13;\n  tmpvar_13 = (((\n    (texture (sampler_blur2, (tmpvar_11 + vec2(0.005, 0.0))).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, (tmpvar_11 - vec2(0.005, 0.0))).xyz * scale2)\n   + bias2)).x * tmpvar_12.x);\n  float tmpvar_14;\n  tmpvar_14 = (((\n    (texture (sampler_blur2, (tmpvar_11 + vec2(0.0, 0.005))).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, (tmpvar_11 - vec2(0.0, 0.005))).xyz * scale2)\n   + bias2)).x * tmpvar_12.y);\n  vec2 tmpvar_15;\n  tmpvar_15.x = tmpvar_13;\n  tmpvar_15.y = tmpvar_14;\n  vec2 tmpvar_16;\n  tmpvar_16.x = (((\n    (texture (sampler_blur2, (tmpvar_11 + vec2(0.005, 0.0))).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, (tmpvar_11 - vec2(0.005, 0.0))).xyz * scale2)\n   + bias2)).x * tmpvar_12.x);\n  tmpvar_16.y = (((\n    (texture (sampler_blur2, (tmpvar_11 + vec2(0.0, 0.005))).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, (tmpvar_11 - vec2(0.0, 0.005))).xyz * scale2)\n   + bias2)).x * tmpvar_12.y);\n  ret_3.x = texture (sampler_fw_main, ((tmpvar_11 - (tmpvar_15 * 0.006)) + (tmpvar_16 * 0.003))).x;\n  ret_3.x = (ret_3.x + ((ret_3.x - \n    ((texture (sampler_blur3, tmpvar_11).xyz * scale3) + bias3)\n  .x) * 0.1));\n  ret_3.x = (ret_3.x + 0.004);\n  vec2 tmpvar_17;\n  tmpvar_17.x = tmpvar_14;\n  tmpvar_17.y = -(tmpvar_13);\n  my_uv_2 = (uv_orig + ((tmpvar_17 * 0.05) * (1.2 - \n    ((texture (sampler_blur3, uv_orig).xyz * scale3) + bias3)\n  .y)));\n  ret_3.z = texture (sampler_fw_main, my_uv_2).z;\n  vec2 x_18;\n  x_18 = (my_uv_2 - uv_orig);\n  ret_3.z = (ret_3.z + ((\n    ((ret_3.z - ((texture (sampler_blur1, uv_orig).xyz * scale1) + bias1).z) * sqrt(dot (x_18, x_18)))\n   * 180.0) / sqrt(\n    dot (tmpvar_12, tmpvar_12)\n  )));\n  ret_3.z = (ret_3.z * 0.85);\n  ret_3.z = (ret_3.z + 0.008);\n  vec2 tmpvar_19;\n  tmpvar_19.x = -(tmpvar_14);\n  tmpvar_19.y = tmpvar_13;\n  my_uv_2 = (tmpvar_19 * 0.045);\n  vec2 tmpvar_20;\n  tmpvar_20.x = (((\n    (texture (sampler_blur2, (tmpvar_11 + vec2(0.01, 0.0))).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, (tmpvar_11 - vec2(0.01, 0.0))).xyz * scale2)\n   + bias2)).y * tmpvar_12.x);\n  tmpvar_20.y = (((\n    (texture (sampler_blur2, (tmpvar_11 + vec2(0.0, 0.01))).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, (tmpvar_11 - vec2(0.0, 0.01))).xyz * scale2)\n   + bias2)).y * tmpvar_12.y);\n  my_uv_2 = (my_uv_2 + (tmpvar_11 - (tmpvar_20 * 0.03)));\n  ret_3.y = texture (sampler_fw_main, my_uv_2).y;\n  ret_3.y = (ret_3.y + ((\n    (ret_3.y - ((texture (sampler_blur3, my_uv_2).xyz * scale3) + bias3).y)\n   * 0.1) + 0.03));\n  vec4 tmpvar_21;\n  tmpvar_21.w = 1.0;\n  tmpvar_21.xyz = ret_3;\n  ret = tmpvar_21.xyz;\n }","comp":" shader_body { \n  vec2 dz_1;\n  vec3 dy_2;\n  vec3 dx_3;\n  vec2 d_4;\n  vec3 ret_5;\n  vec2 tmpvar_6;\n  vec2 tmpvar_7;\n  tmpvar_7 = (vec2(1.0, 0.0) * texsize.zw);\n  tmpvar_6.x = (texture (sampler_main, (uv + tmpvar_7)).xyz - texture (sampler_main, (uv - tmpvar_7)).xyz).y;\n  vec2 tmpvar_8;\n  tmpvar_8 = (vec2(0.0, 1.0) * texsize.zw);\n  tmpvar_6.y = (texture (sampler_main, (uv + tmpvar_8)).xyz - texture (sampler_main, (uv - tmpvar_8)).xyz).y;\n  d_4 = (texsize.zw * 2.0);\n  dx_3 = (((texture (sampler_blur1, \n    (uv + (vec2(1.0, 0.0) * d_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(1.0, 0.0) * d_4))\n  ).xyz * scale1) + bias1));\n  dy_2 = (((texture (sampler_blur1, \n    (uv + (vec2(0.0, 1.0) * d_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(0.0, 1.0) * d_4))\n  ).xyz * scale1) + bias1));\n  vec2 tmpvar_9;\n  tmpvar_9.x = dx_3.y;\n  tmpvar_9.y = dy_2.y;\n  dz_1 = ((tmpvar_6 * 3.0) + tmpvar_9);\n  ret_5 = (vec3(((\n    pow ((sqrt(dot (dz_1, dz_1)) * 0.8), 0.7)\n   + \n    (((texture (sampler_blur2, uv).xyz * scale2) + bias2).y * 0.4)\n  ) - 0.1)) * vec3(0.3, 0.5, 0.7));\n  vec2 tmpvar_10;\n  tmpvar_10.x = dx_3.x;\n  tmpvar_10.y = dy_2.x;\n  vec3 tmpvar_11;\n  tmpvar_11 = mix (mix (ret_5, vec3(0.2, 0.1, 0.0), vec3((texture (sampler_main, \n    (uv + ((tmpvar_10 * texsize.zw) * 18.0))\n  ).x * 6.0))), vec3(1.0, 1.0, 1.0), texture (sampler_main, uv).zzz);\n  ret_5 = tmpvar_11;\n  vec4 tmpvar_12;\n  tmpvar_12.w = 1.0;\n  tmpvar_12.xyz = tmpvar_11;\n  ret = tmpvar_12.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":100,"thickoutline":1,"rad":0.02015,"tex_ang":0.12566,"tex_zoom":1.51878,"r":0,"a":0.1,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.y3=0;a.y1=0;a.q12=0;a.x1=0;a.vx3=0;a.q13=0;a.q15=0;a.q6=0;a.dt=0;a.q1=0;a.q5=0;a.q9=0;a.vx4=0;a.x3=0;a.q11=0;a.q10=0;a.xx2=0;a.q4=0;a.yy1=0;a.vy4=0;a.q16=0;a.x4=0;a.x2=0;a.vy2=0;a.y2=0;a.q2=0;a.q14=0;a.vx2=0;a.q3=0;a.y4=0;a.q7=0;a.vy3=0;a.xx1=0;a.q8=0;
return a;},frame_eqs:function(a){
a.warp=0;a.wave_a=0;a.xx1=.9*a.xx1+.01*a.bass;a.xx2=.9*a.xx2+.01*a.treb;a.yy1=.94*a.yy1+.0075*(a.treb+a.bass);a.x1=.5+2*(a.xx1-a.xx2);a.y1=.4+1.5*a.yy1;a.dt=div(.03,a.fps);a.vx2=a.vx2*(1-2*a.dt)+10*a.dt*(a.x1+a.x3-2*a.x2);a.vy2=a.vy2*(1-2*a.dt)+a.dt*(10*(a.y1+a.y3-2*a.y2)-.5);a.vx3=a.vx3*(1-2*a.dt)+10*a.dt*(a.x2+a.x4-2*a.x3);a.vy3=a.vy3*(1-2*a.dt)+a.dt*(10*(a.y2+a.y4-2*a.y3)-.5);a.vx4=a.vx4*(1-2*a.dt)+10*a.dt*(a.x3-a.x4);a.vy4=a.vy4*(1-2*a.dt)+a.dt*(10*(a.y3-a.y4)-.5);a.x2+=
a.vx2;a.y2+=a.vy2;a.x3+=a.vx3;a.y3+=a.vy3;a.x4+=a.vx4;a.y4+=a.vy4;a.vx2=.00001<Math.abs(above(a.x2,0))?a.vx2:.5*Math.abs(a.vx2);a.vx2=.00001<Math.abs(below(a.x2,1))?a.vx2:.5*-Math.abs(a.vx2);a.vx3=.00001<Math.abs(above(a.x3,0))?a.vx3:.5*Math.abs(a.vx3);a.vx3=.00001<Math.abs(below(a.x3,1))?a.vx3:.5*-Math.abs(a.vx3);a.vx4=.00001<Math.abs(above(a.x4,0))?a.vx4:.5*Math.abs(a.vx4);a.vx4=.00001<Math.abs(below(a.x4,1))?a.vx4:.5*-Math.abs(a.vx4);a.vy2=.00001<Math.abs(above(a.y2,0))?a.vy2:.5*Math.abs(a.vy2);
a.vy2=.00001<Math.abs(below(a.y2,1))?a.vy2:.5*-Math.abs(a.vy2);a.vy3=.00001<Math.abs(above(a.y3,0))?a.vy3:.5*Math.abs(a.vy3);a.vy3=.00001<Math.abs(below(a.y3,1))?a.vy3:.5*-Math.abs(a.vy3);a.vy4=.00001<Math.abs(above(a.y4,0))?a.vy4:.5*Math.abs(a.vy4);a.vy4=.00001<Math.abs(below(a.y4,1))?a.vy4:.5*-Math.abs(a.vy4);a.q1=a.x1;a.q2=a.x2;a.q3=a.x3;a.q4=a.x4;a.q5=a.y1;a.q6=a.y2;a.q7=a.y3;a.q8=a.y4;a.q9=div(1,a.aspectx);a.q10=div(1,a.aspecty);a.q11=a.aspectx;a.q12=a.aspecty;a.q13=sqrt(a.vx4*a.vx4+a.vy4*a.vy4);
a.q14=Math.atan2(a.vx4,a.vy4);a.q15=Math.sin(a.q14);a.q16=Math.cos(a.q14);
return a;},pixel_eqs:''}),
"Flexi - piercing":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1.9,"echo_zoom":1.169,"echo_orient":1,"wave_mode":5,"additivewave":1,"wave_a":0,"wave_scale":0.9,"wave_smoothing":0.63,"wave_mystery":1,"modwavealphastart":2,"modwavealphaend":2,"warpscale":2.853,"rot":0.006,"warp":0,"wave_r":0.65,"wave_g":0.65,"wave_b":0.65,"ob_size":0.005,"mv_x":0,"mv_y":48,"mv_dx":-0.941,"mv_dy":0.426,"mv_l":5,"mv_r":0.316,"mv_g":0.078,"mv_b":0.942,"mv_a":0,"b1ed":0},"warp":"vec2 xlat_mutabled;\nvec3 xlat_mutabledx;\nvec3 xlat_mutabledy;\n shader_body { \n  vec3 ret_1;\n  vec3 tmpvar_2;\n  tmpvar_2 = (texture (sampler_noise_lq, ((\n    (uv_orig * texsize.xy)\n   * texsize_noise_lq.zw) + rand_frame.xy)).xyz - 0.5);\n  xlat_mutabled = (texsize.zw * 4.0);\n  xlat_mutabledx = (((texture (sampler_blur1, \n    (uv_orig + (vec2(1.0, 0.0) * xlat_mutabled))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv_orig - (vec2(1.0, 0.0) * xlat_mutabled))\n  ).xyz * scale1) + bias1));\n  xlat_mutabledy = (((texture (sampler_blur1, \n    (uv_orig + (vec2(0.0, 1.0) * xlat_mutabled))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv_orig - (vec2(0.0, 1.0) * xlat_mutabled))\n  ).xyz * scale1) + bias1));\n  xlat_mutabled = uv;\n  vec2 tmpvar_3;\n  tmpvar_3.x = xlat_mutabledx.y;\n  tmpvar_3.y = xlat_mutabledy.y;\n  vec2 tmpvar_4;\n  tmpvar_4.x = xlat_mutabledx.z;\n  tmpvar_4.y = xlat_mutabledy.z;\n  vec4 tmpvar_5;\n  tmpvar_5 = texture (sampler_main, uv_orig);\n  ret_1.y = ((texture (sampler_main, (uv - \n    ((tmpvar_3 * texsize.zw) * 6.0)\n  )).y - 0.008) + ((1.0 - tmpvar_5.x) * 0.018));\n  ret_1.z = ((texture (sampler_main, (uv - \n    ((tmpvar_4 * texsize.zw) * 6.0)\n  )).z - 0.008) + (tmpvar_5.x * 0.018));\n  ret_1.x = texture (sampler_fc_main, (uv + ((tmpvar_2.xy * texsize.zw) * 0.5))).x;\n  ret_1.x = (ret_1.x + ((\n    (ret_1.x - ((texture (sampler_blur3, uv).xyz * scale3) + bias3).x)\n   * 0.15) + (tmpvar_2 * 0.0042)).x);\n  vec4 tmpvar_6;\n  tmpvar_6.w = 1.0;\n  tmpvar_6.xyz = ret_1;\n  ret = tmpvar_6.xyz;\n }","comp":" shader_body { \n  vec2 dz_1;\n  vec3 dy_2;\n  vec3 dx_3;\n  vec2 d_4;\n  vec3 ret_5;\n  vec2 tmpvar_6;\n  vec2 tmpvar_7;\n  tmpvar_7 = (vec2(1.0, 0.0) * texsize.zw);\n  tmpvar_6.x = (texture (sampler_main, (uv + tmpvar_7)).xyz - texture (sampler_main, (uv - tmpvar_7)).xyz).y;\n  vec2 tmpvar_8;\n  tmpvar_8 = (vec2(0.0, 1.0) * texsize.zw);\n  tmpvar_6.y = (texture (sampler_main, (uv + tmpvar_8)).xyz - texture (sampler_main, (uv - tmpvar_8)).xyz).y;\n  d_4 = (texsize.zw * 2.0);\n  dx_3 = (((texture (sampler_blur1, \n    (uv + (vec2(1.0, 0.0) * d_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(1.0, 0.0) * d_4))\n  ).xyz * scale1) + bias1));\n  dy_2 = (((texture (sampler_blur1, \n    (uv + (vec2(0.0, 1.0) * d_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(0.0, 1.0) * d_4))\n  ).xyz * scale1) + bias1));\n  vec2 tmpvar_9;\n  tmpvar_9.x = dx_3.y;\n  tmpvar_9.y = dy_2.y;\n  dz_1 = ((tmpvar_6 * 3.0) + tmpvar_9);\n  ret_5 = (vec3(((\n    pow ((sqrt(dot (dz_1, dz_1)) * 0.8), 0.7)\n   + \n    (((texture (sampler_blur2, uv).xyz * scale2) + bias2).y * 0.4)\n  ) - 0.1)) * vec3(0.3, 0.5, 0.7));\n  vec2 tmpvar_10;\n  tmpvar_10.x = dx_3.x;\n  tmpvar_10.y = dy_2.x;\n  vec3 tmpvar_11;\n  tmpvar_11 = mix (mix (ret_5, vec3(0.2, 0.1, 0.0), vec3((texture (sampler_main, \n    (uv + ((tmpvar_10 * texsize.zw) * 18.0))\n  ).x * 6.0))), vec3(1.0, 1.0, 1.0), texture (sampler_main, uv).zzz);\n  ret_5 = tmpvar_11;\n  vec4 tmpvar_12;\n  tmpvar_12.w = 1.0;\n  tmpvar_12.xyz = tmpvar_11;\n  ret = tmpvar_12.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":100,"textured":1,"rad":0.78903,"ang":0.62832,"tex_zoom":1.02009,"r":0,"g":1,"b":1,"r2":0.7,"b2":1,"border_a":0}},{init_eqs:function(a){
a.vx=0;a.vy=0;
return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.d=0;a.res=0;a.q1=0;a.c_x=0;a.c_y=0;a.v=0;a.diff=0;a.q4=0;a.r=0;a.beat=0;a.vol=0;a.q2=0;a.q3=0;a.c_x=.5;a.c_y=.5;
return a;},frame_eqs:function(a){
a.sx=1+.01*mod(8*a.bass,8)*equal(mod(a.time,Math.floor(24-2*a.bass)),0);a.sy=1+.01*mod(8*a.mid,8)*equal(mod(a.time,12+Math.floor(24-2*a.bass)),0);a.q1=a.aspectx;a.q2=a.aspecty;a.rot=0;a.zoom=1;a.warp=0;a.vol=8*a.bass+4*a.mid+2*a.treb;a.vol*=above(a.vol,17);a.monitor=a.vol;a.beat=above(a.vol,a.res);a.diff=(1-a.beat)*a.diff+a.beat*(a.vol-a.res);a.res=a.beat*(a.vol+2*a.diff)+(1-a.beat)*(a.res-div(60*(.04*a.diff+.12),a.fps));a.res=Math.max(0,a.res);a.monitor=a.res;a.r=.00001<Math.abs(a.beat)?
.0001*(randint(200)-100):a.r;a.rot=a.r;a.c_x=.00001<Math.abs(a.beat)?.5+.005*(randint(200)-100):a.c_x;a.c_y=.00001<Math.abs(a.beat)?.5+.005*(randint(200)-100):a.c_y;a.q3=a.c_x;a.q4=a.c_y;
return a;},pixel_eqs:function(a){
a.d=pow(sqrt(sqr(a.x-a.q3)+sqr(a.y-a.q4)),2)-0;a.v=.03;a.dx=a.v*(a.x-a.q3)*a.d;a.dy=a.v*(a.y-a.q4)*a.d;
return a;}}),
"Flexi - reality tunnel":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1,"decay":0.5,"echo_zoom":1,"echo_orient":3,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_a":0.009,"wave_scale":1.554,"wave_smoothing":0,"modwavealphastart":1.2,"modwavealphaend":1.2,"warpanimspeed":0.01,"warpscale":100,"zoomexp":0.19913,"warp":0.01359,"wave_r":0,"wave_b":0.04,"ob_size":0.005,"ob_a":1,"ib_size":0.5,"ib_r":1,"ib_g":1,"ib_b":1,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0},"warp":" shader_body { \n  vec2 uv_z_1;\n  vec3 ret_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = (1.0 - abs((\n    (fract((uv * 0.5)) * 2.0)\n   - 1.0)));\n  ret_2.x = (texture (sampler_fc_main, tmpvar_3).x * 0.5);\n  vec2 tmpvar_4;\n  tmpvar_4 = (texsize.zw * 4.0);\n  vec2 tmpvar_5;\n  vec2 tmpvar_6;\n  tmpvar_6 = (uv_orig - 0.5);\n  tmpvar_5 = ((tmpvar_6 * 0.996) + 0.5);\n  vec2 tmpvar_7;\n  tmpvar_7.x = (((texture (sampler_blur1, \n    (tmpvar_5 + (vec2(1.0, 0.0) * tmpvar_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (tmpvar_5 - (vec2(1.0, 0.0) * tmpvar_4))\n  ).xyz * scale1) + bias1)).z;\n  tmpvar_7.y = (((texture (sampler_blur1, \n    (tmpvar_5 + (vec2(0.0, 1.0) * tmpvar_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (tmpvar_5 - (vec2(0.0, 1.0) * tmpvar_4))\n  ).xyz * scale1) + bias1)).z;\n  uv_z_1 = (tmpvar_5 - ((tmpvar_7 * texsize.zw) * 2.0));\n  ret_2.z = max (((\n    (texture (sampler_fc_main, tmpvar_3).x - 0.5)\n   * 3.0) * clamp (\n    (1.0 - (sqrt(dot (tmpvar_6, tmpvar_6)) * 3.2))\n  , 0.0, 1.0)), texture (sampler_fc_main, uv_z_1).z);\n  ret_2.z = (ret_2.z + ((texture (sampler_fc_main, uv_z_1).z - \n    ((texture (sampler_blur1, clamp (uv_z_1, 0.0, 1.0)).xyz * scale1) + bias1)\n  .z) * 0.02));\n  ret_2.y = (max (texture (sampler_fc_main, mix (uv, uv_orig, vec2(0.9996, 0.9996))).y, texture (sampler_fc_main, uv_orig).z) - 0.008);\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_2;\n  ret = tmpvar_8.xyz;\n }","comp":" shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1 = (texsize.zw * 4.0);\n  vec2 tmpvar_2;\n  tmpvar_2.x = (((texture (sampler_blur1, \n    (uv + (vec2(1.0, 0.0) * tmpvar_1))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(1.0, 0.0) * tmpvar_1))\n  ).xyz * scale1) + bias1)).y;\n  tmpvar_2.y = (((texture (sampler_blur1, \n    (uv + (vec2(0.0, 1.0) * tmpvar_1))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(0.0, 1.0) * tmpvar_1))\n  ).xyz * scale1) + bias1)).y;\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = mix ((texture (sampler_fc_main, (uv - \n    (tmpvar_2 * 0.4)\n  )).x * pow (hue_shader.zxy, vec3(4.0, 4.0, 4.0))), (mix (\n    (pow (hue_shader, vec3(6.0, 6.0, 6.0)) * 1.2)\n  , \n    pow (hue_shader, vec3(8.0, 8.0, 8.0))\n  .yzx, texture (sampler_main, uv).yyy) * 2.0), vec3(((\n    (texture (sampler_blur1, uv).xyz * scale1)\n   + bias1).z * 0.7)));\n  ret = tmpvar_3.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":100,"additive":1,"thickoutline":1,"rad":0.86644,"g":0.03,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.d=0;a.xx=0;a.w=0;a.cz=0;a.my=0;a.vx=0;a.vy=0;a.mx=0;a.yy=0;
return a;},frame_eqs:function(a){

return a;},pixel_eqs:function(a){
a.vx=.5+.5*Math.cos(.2*a.time);a.vy=.5+.5*Math.sin(.2*a.time);a.x-=a.vx;a.y-=a.vy;a.d=.1*a.time;a.xx=Math.sin(a.d)*a.x+Math.cos(a.d)*a.y;a.yy=Math.cos(a.d)*a.x-Math.sin(a.d)*a.y;a.x=a.xx;a.y=a.yy;a.cz=.5;a.zoom=.33;a.w=div(1,a.zoom)*(1+sqrt(sqr(a.cz)+sqr(a.x-a.cx)+sqr(a.y-a.cy)));a.dx=(a.x-a.mx)*a.w;a.dy=(a.y-a.my)*a.w;
return a;}}),
"Flexi, Rovastar + Geiss - Fractopia vs bas relief":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1,"decay":0.5,"echo_zoom":1,"echo_orient":3,"wave_thick":1,"modwavealphabyvolume":1,"wave_a":0.009,"wave_scale":2.136,"wave_smoothing":0.9,"modwavealphastart":1.6,"modwavealphaend":1.6,"warpanimspeed":9.861,"warpscale":16.217,"zoomexp":1.50374,"wave_r":0,"wave_g":0.04,"wave_b":0,"ob_size":0,"ob_r":1,"ob_g":0.1,"ob_a":1,"ib_size":0,"ib_r":0,"ib_g":0,"ib_b":0,"ib_a":1,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0},"warp":" shader_body { \n  vec2 uv_z_1;\n  vec3 ret_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = (1.0 - abs((\n    (fract((uv * 0.5)) * 2.0)\n   - 1.0)));\n  ret_2.x = texture (sampler_fc_main, tmpvar_3).z;\n  ret_2.y = mix (mix (texture (sampler_fc_main, tmpvar_3).x, ret_2.x, 0.5), texture (sampler_main, uv_orig).y, 0.75);\n  vec2 tmpvar_4;\n  tmpvar_4 = (texsize.zw * 6.0);\n  vec2 tmpvar_5;\n  vec2 tmpvar_6;\n  tmpvar_6 = (uv_orig - 0.5);\n  tmpvar_5 = ((tmpvar_6 * 0.998) + 0.5);\n  vec2 tmpvar_7;\n  tmpvar_7.x = (((texture (sampler_blur1, \n    (tmpvar_5 + (vec2(1.0, 0.0) * tmpvar_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (tmpvar_5 - (vec2(1.0, 0.0) * tmpvar_4))\n  ).xyz * scale1) + bias1)).z;\n  tmpvar_7.y = (((texture (sampler_blur1, \n    (tmpvar_5 + (vec2(0.0, 1.0) * tmpvar_4))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (tmpvar_5 - (vec2(0.0, 1.0) * tmpvar_4))\n  ).xyz * scale1) + bias1)).z;\n  uv_z_1 = (tmpvar_5 - ((tmpvar_7 * texsize.zw) * 2.0));\n  ret_2.z = max (((\n    (texture (sampler_fc_main, tmpvar_3).x - 0.5)\n   * 3.0) * clamp (\n    (1.0 - (sqrt(dot (tmpvar_6, tmpvar_6)) * 3.2))\n  , 0.0, 1.0)), texture (sampler_fc_main, uv_z_1).z);\n  ret_2.z = (ret_2.z + ((texture (sampler_fc_main, uv_z_1).z - \n    ((texture (sampler_blur1, clamp (uv_z_1, 0.0, 1.0)).xyz * scale1) + bias1)\n  .z) * 0.02));\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_2;\n  ret = tmpvar_8.xyz;\n }","comp":" shader_body { \n  vec2 uv2_1;\n  vec3 ret_2;\n  uv2_1 = (uv + (vec2(1.0, 0.0) * texsize.zw));\n  float tmpvar_3;\n  tmpvar_3 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(-1.0, 0.0) * texsize.zw));\n  float tmpvar_4;\n  tmpvar_4 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, 1.0) * texsize.zw));\n  float tmpvar_5;\n  tmpvar_5 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, -1.0) * texsize.zw));\n  vec3 tmpvar_6;\n  tmpvar_6.z = 0.14;\n  tmpvar_6.x = (tmpvar_3 - tmpvar_4);\n  tmpvar_6.y = (tmpvar_5 - ((\n    (texture (sampler_main, uv2_1).xyz + (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4))\n   + \n    (((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2) * 0.15)\n  ) + (\n    ((texture (sampler_blur3, uv2_1).xyz * scale3) + bias3)\n   * 0.1)).x);\n  ret_2 = (0.5 + (0.5 * normalize(tmpvar_6)));\n  vec2 x_7;\n  x_7 = (ret_2.xy - 0.5);\n  ret_2 = (ret_2 * clamp ((\n    sqrt(dot (x_7, x_7))\n   * 5.0), 0.0, 1.0));\n  ret_2 = ret_2.xxy;\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_2;\n  ret = tmpvar_8.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.xpos=0;a.yamptarg=0;a.y_pos=0;a.ydir=0;a.meanbass_att=0;a.q1=0;a.myx=0;a.myy=0;a.lastbeat=0;a.beatrate=0;a.peakbass_att=0;a.xamptarg=0;a.xamp=0;a.xspeed=0;a.ypos=0;a.movement=0;a.att=0;a.volume=0;a.beat=0;a.q2=0;a.yamp=0;a.q3=0;a.xdir=0;a.q8=0;a.yspeed=0;
return a;},frame_eqs:function(a){
a.warp=0;a.volume=.3*(a.bass+a.mid+a.att);a.xamptarg=.00001<Math.abs(equal(mod(a.frame,15),0))?Math.min(.25*a.volume*a.bass_att,.5):a.xamptarg;a.xamp+=.5*(a.xamptarg-a.xamp);a.xdir=.00001<Math.abs(above(Math.abs(a.xpos),a.xamp))?-sign(a.xpos):.00001<Math.abs(below(Math.abs(a.xspeed),.1))?2*above(a.xpos,0)-1:a.xdir;a.xspeed=a.xspeed+a.xdir*a.xamp-a.xpos-.055*a.xspeed*below(Math.abs(a.xpos),a.xamp);a.xpos+=.001*a.xspeed;a.yamptarg=.00001<Math.abs(equal(mod(a.frame,15),0))?Math.min(.15*
a.volume*a.treb_att,.5):a.yamptarg;a.yamp+=.5*(a.yamptarg-a.yamp);a.ydir=.00001<Math.abs(above(Math.abs(a.ypos),a.yamp))?-sign(a.ypos):.00001<Math.abs(below(Math.abs(a.yspeed),.1))?2*above(a.ypos,0)-1:a.ydir;a.yspeed=a.yspeed+a.ydir*a.yamp-a.ypos-.055*a.yspeed*below(Math.abs(a.ypos),a.yamp);a.ypos+=.001*a.yspeed;a.beatrate=equal(a.beatrate,0)+(1-equal(a.beatrate,0))*(below(a.volume,.01)+(1-below(a.volume,.01))*a.beatrate);a.lastbeat+=equal(a.lastbeat,0)*a.time;a.meanbass_att=.1*(9*a.meanbass_att+
a.bass_att);a.peakbass_att=Math.max(a.bass_att,a.peakbass_att);a.beat=above(a.volume,.8)*below(a.peakbass_att-a.bass_att,.05*a.peakbass_att)*above(a.time-a.lastbeat,.1+.5*(a.beatrate-.1));a.beatrate=Math.max(.00001<Math.abs(a.beat)?.00001<Math.abs(below(a.time-a.lastbeat,2*a.beatrate))?.1*(9*a.beatrate+a.time-a.lastbeat):a.beatrate:a.beatrate,.1);a.peakbass_att=a.beat*a.bass_att+(1-a.beat)*a.peakbass_att*(.95*above(a.time-a.lastbeat,2*a.beatrate)+.995*(1-above(a.time-a.lastbeat,2*a.beatrate)));a.lastbeat=
a.beat*a.time+(1-a.beat)*a.lastbeat;a.peakbass_att=Math.max(a.peakbass_att,1.1*a.meanbass_att);a.wave_r=.5+.499*(.6*Math.sin(.98*a.time)+.4*Math.sin(1.047*a.time));a.wave_g=.5+.499*(.6*Math.sin(.835*a.time)+.4*Math.sin(1.081*a.time));a.wave_b=.5+.499*(.6*Math.sin(.814*a.time)+.4*Math.sin(1.011*a.time));a.wave_mystery=-.17+.03*(.6*Math.sin(.637*a.time)+.4*Math.sin(.949*a.time));a.mv_r=.00001<Math.abs(a.beat)?1:a.ib_r;a.mv_b=.00001<Math.abs(a.beat)?a.wave_b:a.ib_b;a.q3=a.wave_mystery;a.q1=a.wave_x;
a.q2=1-a.wave_y;a.q2=a.ypos+.5;a.warp=0;a.ob_r=1-a.wave_g;a.ob_b=1-a.wave_r;a.ob_g=1-a.wave_b;a.monitor=a.wave_y;a.movement+=.4*div(a.bass+a.bass_att+.1*pow(a.bass+.6*a.bass_att+.2*a.treb_att,3),a.fps);a.movement=.00001<Math.abs(above(a.movement,1E4))?0:a.movement;a.rot=Math.sin(a.movement);a.cx=a.wave_x;a.cy=a.y_pos+.5;a.q8=a.movement;
return a;},pixel_eqs:function(a){
a.myy=a.x-a.q1;a.myx=a.y-a.q2+.1;a.dx=6*Math.sin(.675*a.q8)*a.myx*a.myy;a.dy=3*Math.sin(.675*a.q8)*(a.myx*a.myx-a.myy*a.myy);
return a;}}),
"flexi, stahlregen, geiss + tobias wolfboi - space gelatine burst - mash0000 - chromatidal pool mirror blasphemy":()=>Object.assign({"baseVals":{"rating":4,"gammaadj":1,"decay":1,"additivewave":1,"modwavealphabyvolume":1,"wave_a":0.009,"wave_scale":2.713,"wave_smoothing":0,"modwavealphastart":1.2,"modwavealphaend":1.2,"warpscale":1.331,"zoom":0.99951,"warp":0.00909,"wave_r":0.44,"wave_g":0.4,"ob_size":0.5,"ob_r":0.01,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0,"b1ed":0},"warp":" shader_body { \n  vec2 uv_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = normalize((uv_orig - 0.5));\n  float tmpvar_3;\n  tmpvar_3 = (time * 7.0);\n  uv_1 = (mix (uv_orig, uv, vec2((\n    clamp ((((bass / bass_att) - 0.9) * 13.0), 0.0, 1.0)\n   * 0.3))) + ((\n    (tmpvar_2 * texsize.zw)\n   * \n    cos(((rad * 170.0) - tmpvar_3))\n  ) * 2.0));\n  uv_1 = (uv_1 + ((\n    (vec2(5.0, -5.0) * texsize.zw)\n   * \n    cos(((ang * 30.0) - tmpvar_3))\n  ) * tmpvar_2.yx));\n  vec4 tmpvar_4;\n  tmpvar_4.w = 1.0;\n  tmpvar_4.xyz = (texture (sampler_pw_main, uv_1).xyz - 0.004);\n  ret = tmpvar_4.xyz;\n }","comp":" shader_body { \n  vec2 uv2_1;\n  vec3 ret_2;\n  uv2_1 = (uv + (vec2(1.0, 0.0) * texsize.zw));\n  float tmpvar_3;\n  tmpvar_3 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(-1.0, 0.0) * texsize.zw));\n  float tmpvar_4;\n  tmpvar_4 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, 1.0) * texsize.zw));\n  float tmpvar_5;\n  tmpvar_5 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, -1.0) * texsize.zw));\n  vec3 tmpvar_6;\n  tmpvar_6.z = 0.14;\n  tmpvar_6.x = (tmpvar_3 - tmpvar_4);\n  tmpvar_6.y = (tmpvar_5 - ((\n    (texture (sampler_main, uv2_1).xyz + (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4))\n   + \n    (((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2) * 0.15)\n  ) + (\n    ((texture (sampler_blur3, uv2_1).xyz * scale3) + bias3)\n   * 0.1)).x);\n  ret_2 = (0.5 + (0.5 * normalize(tmpvar_6)));\n  vec2 x_7;\n  x_7 = (ret_2.xy - 0.5);\n  ret_2 = (ret_2 * clamp ((\n    sqrt(dot (x_7, x_7))\n   * 5.0), 0.0, 1.0));\n  ret_2 = ret_2.xxy;\n  ret_2 = (ret_2 + 1.0);\n  ret_2 = (ret_2 * mix (ret_2, (ret_2 * \n    (((texture (sampler_blur3, uv).xyz * scale3) + bias3) - ((texture (sampler_blur1, uv).xyz * scale1) + bias1))\n  ), pow (hue_shader, ret_2)));\n  ret_2 = (ret_2 * hue_shader);\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_2;\n  ret = tmpvar_8.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":12,"additive":1,"num_inst":2,"x":0.49,"rad":0.09902,"tex_zoom":4.36077,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=div(randint(1E3),1E3);a.y=div(randint(1E3),1E3);a.ang=div(randint(150),100);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.d=0;a.res=0;a.q1=0;a.x=0;a.v=0;a.diff=0;a.r=0;a.y=0;a.beat=0;a.vol=0;a.q2=0;a.m=0;
return a;},frame_eqs:function(a){
a.vol=8*a.bass+5*a.mid+3*a.treb;a.m=.97*a.m+.08*a.vol;a.monitor=a.vol;a.beat=above(a.vol,a.res)*above(a.vol,a.m)*above(a.vol,16);a.diff=(1-a.beat)*a.diff+a.beat*(a.vol-a.res);a.res=a.beat*(a.vol+.1*a.m)+(1-a.beat)*(a.res-div(60*(.1+.02*a.diff),a.fps));a.res=Math.max(0,a.res);a.x=.00001<Math.abs(a.beat)?.01*randint(60)+.2:a.x;a.y=.00001<Math.abs(a.beat)?.01*randint(60)+.2:a.y;a.q1=a.x;a.q2=a.y;a.wave_x=a.q1;a.wave_y=1-a.q2;
return a;},pixel_eqs:function(a){
a.cx=a.q1;a.cy=a.q2;a.d=pow(sqrt(sqr(a.x-a.cx)+sqr(a.y-a.cy)),.8);a.r=.2;a.v=.2;a.dx=(a.x-a.cx)*a.v*(a.d-a.r);a.dy=(a.y-a.cy)*a.v*(a.d-a.r);
return a;}}),
"Geiss - Feedback 2":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1,"decay":0.9,"echo_zoom":0.710682,"wave_mode":6,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"wave_a":0.311604,"wave_scale":1.22891,"wave_smoothing":0,"wave_mystery":0.2,"modwavealphastart":0.71,"modwavealphaend":1.3,"zoom":0.999902,"warp":0.207965,"wave_r":0.65,"wave_g":0.65,"wave_b":0.65,"ob_size":0.0065,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0},"pixel_eqs":"","warp":"","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":1,"x":0.37,"rad":2.999997,"ang":3.644249,"r":0,"a":0.5,"g2":0,"a2":0.3,"border_a":1}},{init_eqs:function(a){
a.t1=0;a.t2=0;a.t1=.01*randint(100);a.t2=.01*randint(100);
return a;},frame_eqs:function(a){
a.ang=a.time*(.3+.1*a.t1);a.rad*=.9+.2*a.t2;a.r=Math.min(1,Math.max(0,a.r+.2*Math.sin(.417*a.time+1)));a.g=Math.min(1,Math.max(0,a.g+.2*Math.sin(.391*a.time+2)));a.b=Math.min(1,Math.max(0,a.b+.2*Math.sin(.432*a.time+4)));a.r2=Math.min(1,Math.max(0,a.r2+.2*Math.sin(.657*a.time+3)));a.g2=Math.min(1,Math.max(0,a.g2+.2*Math.sin(.737*a.time+5)));a.b2=Math.min(1,Math.max(0,a.b2+.2*Math.sin(.884*a.time+6)));
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":5,"additive":1,"textured":1,"x":0.37,"rad":0.706533,"ang":3.644249,"g":1,"b":1,"a":0.8,"r2":1,"b2":1,"border_a":0}},{init_eqs:function(a){
a.t1=0;a.t2=0;a.t1=.01*randint(100);a.t2=.01*randint(100);
return a;},frame_eqs:function(a){
a.x+=.05*Math.sin(1.25*a.time+3);a.y+=.03*Math.sin(1.49*a.time+1);a.ang=a.time*(.3+.1*a.t1);a.rad*=.9+.2*a.t2;a.r=Math.min(1,Math.max(0,a.r+.1*Math.sin(.417*a.time+1)));a.g=Math.min(1,Math.max(0,a.g+.1*Math.sin(.391*a.time+2)));a.b=Math.min(1,Math.max(0,a.b+.1*Math.sin(.432*a.time+4)));a.r2=Math.min(1,Math.max(0,a.r2+.1*Math.sin(.457*a.time+3)));a.g2=Math.min(1,Math.max(0,a.g2+.1*Math.sin(.437*a.time+5)));a.b2=Math.min(1,Math.max(0,a.b2+.1*Math.sin(.484*a.time+6)));
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":5,"additive":1,"textured":1,"x":0.67,"y":0.43,"rad":0.706533,"ang":4.209736,"g":1,"b":1,"a":0.8,"r2":1,"b2":1,"border_a":0}},{init_eqs:function(a){
a.t1=0;a.t2=0;a.t1=.01*randint(100);a.t2=.01*randint(100);
return a;},frame_eqs:function(a){
a.x+=.05*Math.sin(2.17*a.time);a.y+=.03*Math.sin(1.83*a.time);a.ang=a.time*(.3+.1*a.t1);a.rad*=.9+.2*a.t2;a.r=Math.min(1,Math.max(0,a.r+.1*Math.sin(.417*a.time+1)));a.g=Math.min(1,Math.max(0,a.g+.1*Math.sin(.391*a.time+2)));a.b=Math.min(1,Math.max(0,a.b+.1*Math.sin(.432*a.time+4)));a.r2=Math.min(1,Math.max(0,a.r2+.1*Math.sin(.457*a.time+3)));a.g2=Math.min(1,Math.max(0,a.g2+.1*Math.sin(.437*a.time+5)));a.b2=Math.min(1,Math.max(0,a.b2+.1*Math.sin(.484*a.time+6)));
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":6,"rad":0.161222,"g":1,"r2":1,"g2":0,"border_a":1}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x+=.2*Math.sin(1.14*a.time);a.y+=.1*Math.sin(.93*a.time+2);
return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){

return a;},frame_eqs:function(a){
a.wave_mystery=.2*a.time;
return a;},pixel_eqs:''}),
"Illusion & Rovastar - Dotty Mad Space (Jelly)":()=>Object.assign({"baseVals":{"rating":2,"gammaadj":1,"decay":0.9,"echo_zoom":7.524,"echo_alpha":0.6,"wave_mode":6,"additivewave":1,"wave_dots":1,"modwavealphabyvolume":1,"wave_brighten":0,"wrap":0,"brighten":1,"wave_a":2.518,"wave_scale":3.166,"wave_smoothing":0.18,"modwavealphastart":0.55,"modwavealphaend":2,"warpanimspeed":1.53,"warpscale":1.731,"zoomexp":0.99817,"zoom":1.00022,"warp":0.1401,"sx":1.006,"sy":0.9999,"wave_g":0.5,"wave_b":0.5,"mv_x":64,"mv_y":48,"mv_r":0.5,"mv_g":0.6,"mv_b":0.6},"warp":"","comp":" shader_body { \n  vec2 uv2_1;\n  vec3 ret_2;\n  uv2_1 = (uv + (vec2(1.0, 0.0) * texsize.zw));\n  float tmpvar_3;\n  tmpvar_3 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(-1.0, 0.0) * texsize.zw));\n  float tmpvar_4;\n  tmpvar_4 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, 1.0) * texsize.zw));\n  float tmpvar_5;\n  tmpvar_5 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, -1.0) * texsize.zw));\n  vec3 tmpvar_6;\n  tmpvar_6.z = 0.14;\n  tmpvar_6.x = (tmpvar_3 - tmpvar_4);\n  tmpvar_6.y = (tmpvar_5 - ((\n    (texture (sampler_main, uv2_1).xyz + (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4))\n   + \n    (((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2) * 0.15)\n  ) + (\n    ((texture (sampler_blur3, uv2_1).xyz * scale3) + bias3)\n   * 0.1)).x);\n  ret_2 = (0.5 + (0.5 * normalize(tmpvar_6)));\n  vec2 x_7;\n  x_7 = (ret_2.xy - 0.5);\n  ret_2 = (ret_2 * clamp ((\n    sqrt(dot (x_7, x_7))\n   * 5.0), 0.0, 1.0));\n  ret_2 = ret_2.xxy;\n  ret_2 = (ret_2 + 1.15);\n  ret_2 = (ret_2 * mix (ret_2, (ret_2 * \n    (((texture (sampler_blur3, uv).xyz * scale3) + bias3) - ((texture (sampler_blur1, uv).xyz * scale1) + bias1))\n  ), pow (hue_shader.yzx, ret_2)));\n  ret_2 = (ret_2 * ret_2);\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_2;\n  ret = tmpvar_8.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.bass_effect=0;
return a;},frame_eqs:function(a){
a.warp=0;a.bass_effect=Math.max(Math.max(a.bass,a.bass_effect)-1.3,0);a.mv_a=10*a.bass_effect;a.mv_r=.00001<Math.abs(above(a.mid,a.treb))?0:1;a.mv_x=4*Math.sin(3*a.time)+60;a.mv_y=5*Math.sin(5*a.time)+43;a.wave_r=.5*Math.sin(5*a.time)+.5;a.wave_b=.5*Math.cos(12*a.time)+.5;a.wave_g=.5*Math.cos(14*a.time)+.5;
return a;},pixel_eqs:function(a){
a.sx+=.01*a.rad;a.sy+=.00001<Math.abs(above(3.14-a.ang,0))?.1:-.1;
return a;}}),
"martin + stahlregen - martin in da mash 12a":()=>Object.assign({"baseVals":{"rating":3,"gammaadj":1.98,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"wave_mode":4,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"darken":1,"wave_a":0.001,"wave_scale":2.233,"wave_smoothing":0.81,"wave_mystery":0.28,"modwavealphastart":0.47,"modwavealphaend":1.32,"warpanimspeed":1.459,"warpscale":2.007,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0.9,"wave_b":0.9,"ob_size":0.015,"ob_b":1,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0,"b1ed":0},"pixel_eqs":"","warp":"vec3 xlat_mutablemus;\n shader_body { \n  vec2 d_1;\n  vec2 uv6_2;\n  vec2 uv1_3;\n  vec3 ret_4;\n  vec2 tmpvar_5;\n  tmpvar_5 = (uv - 0.5);\n  uv1_3 = tmpvar_5;\n  uv6_2 = tmpvar_5;\n  float x_6;\n  x_6 = (abs(tmpvar_5.x) - abs(tmpvar_5.y));\n  float tmpvar_7;\n  tmpvar_7 = (12.0 * sqrt((x_6 * x_6)));\n  vec2 tmpvar_8;\n  tmpvar_8 = normalize(tmpvar_5);\n  d_1 = tmpvar_8;\n  float tmpvar_9;\n  tmpvar_9 = (float(mod (q28, 2.0)));\n  if ((tmpvar_9 == 0.0)) {\n    d_1 = ((q1 * tmpvar_8) - (q2 / tmpvar_8));\n  };\n  uv1_3 = (tmpvar_5 + ((-0.06 * \n    dot (((texture (sampler_blur1, uv).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n  ) * normalize(tmpvar_5)));\n  uv1_3 = (uv1_3 - (clamp (\n    ((sin(tmpvar_7) / cos(tmpvar_7)) * d_1)\n  , vec2(-4.0, -4.0), vec2(4.0, 4.0)) / 60.0));\n  uv6_2 = (0.4 * cos((\n    (uv1_3 * 2.0)\n   * q28)));\n  xlat_mutablemus = (clamp (vec3((0.0006 / \n    (sqrt(dot (uv6_2, uv6_2)) - (0.002 * (q27 + (8.0 * q28))))\n  )), 0.0, 1.0) * q31);\n  xlat_mutablemus = (xlat_mutablemus * (1.0 + roam_cos).xyz);\n  ret_4 = ((0.4 * (\n    ((texture (sampler_main, ((uv1_3 * \n      (0.8 + (0.2 * tmpvar_7))\n    ) + 0.5)).xyz + xlat_mutablemus) * 0.95)\n   - 0.025)) + (0.6 * texture (sampler_main, uv_orig)).xyz);\n  ret_4 = (ret_4 * (1.0 - (0.5 * \n    dot (((texture (sampler_blur2, vec2(0.55, 0.55)).xyz * scale2) + bias2), vec3(0.32, 0.49, 0.29))\n  )));\n  vec4 tmpvar_10;\n  tmpvar_10.w = 1.0;\n  tmpvar_10.xyz = ret_4;\n  ret = tmpvar_10.xyz;\n }","comp":"vec3 xlat_mutableret1;\n shader_body { \n  vec2 uv_1;\n  float ang2_3;\n  vec2 uv2_4;\n  uv_1 = (uv - 0.5);\n  uv_1 = (uv_1 * aspect.xy);\n  xlat_mutableret1 = vec3(0.0, 0.0, 0.0);\n  for (int n_2 = 0; n_2 <= 9; n_2++) {\n    ang2_3 = ((6.28 * float(n_2)) / 9.0);\n    float tmpvar_5;\n    tmpvar_5 = cos(ang2_3);\n    float tmpvar_6;\n    tmpvar_6 = sin(ang2_3);\n    uv2_4.x = ((uv_1.x * tmpvar_5) - (uv_1.y * tmpvar_6));\n    uv2_4.y = ((uv_1.x * tmpvar_6) + (uv_1.y * tmpvar_5));\n    xlat_mutableret1 = max (xlat_mutableret1, texture (sampler_main, (uv2_4 + 0.5)).xyz);\n  };\n  vec4 tmpvar_7;\n  tmpvar_7.w = 1.0;\n  tmpvar_7.xyz = (xlat_mutableret1 * 2.0);\n  ret = tmpvar_7.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"thick":1,"additive":1,"scaling":0.89152,"smoothing":0.82,"a":0.9}},{init_eqs:function(a){
a.xang=0;a.ampl=0;a.fov=0;a.t1=0;a.yang=0;a.my=0;a.oz=0;a.k1=0;a.t_rel=0;a.k2=0;a.mz=0;a.oy=0;a.mx=0;a.t2=0;a.zang=0;a.monitor=0;a.t_abs=0;a.ox=0;a.t1=1+.3*(.01*randint(101)-.01*randint(101));a.t2=1+.3*(.01*randint(101)-.01*randint(101));a.t3=1+.3*(.01*randint(101)-.01*randint(101));a.t4=1+.3*(.01*randint(101)-.01*randint(101));a.t5=1+.3*(.01*randint(101)-.01*randint(101));a.t6=1+.3*(.01*randint(101)-.01*randint(101));a.t7=1+.3*(.01*randint(101)-.01*randint(101));a.t8=1+.3*
(.01*randint(101)-.01*randint(101));
return a;},frame_eqs:function(a){
a.t2+=a.bass_att;
return a;},point_eqs:function(a){
a.k1=Math.cos(div(a.time,3));a.k2=Math.sin(div(a.time,2));a.t_abs=a.sample;a.t_rel=a.sample-div(a.time,2.12);a.ampl=5*Math.cos(a.t_rel);a.ox=Math.sin(8*a.t_rel)+a.ampl*Math.sin(12*a.t_rel);a.oy=Math.cos(13*a.t_rel)+a.ampl*Math.cos(11*a.t_rel);a.oz=div(a.ampl,3);a.r=1;a.g=.5;a.b=0;a.a=.25*Math.cos(div(3.14*a.t_abs,2))+.2*below(Math.abs(1-a.t_abs-a.t1),0);a.a=.25*Math.cos(1.5*a.t_abs)+.7*below(Math.abs(a.t_abs),0);a.xang=3*a.k1;a.yang=1;a.zang=3*a.k1;a.fov=.22;a.monitor=a.t2;
a.mx=a.ox*Math.cos(a.zang)-a.oy*Math.sin(a.zang);a.my=a.ox*Math.sin(a.zang)+a.oy*Math.cos(a.zang);a.ox=a.mx;a.oy=a.my;a.mx=a.ox*Math.cos(a.yang)+a.oz*Math.sin(a.yang);a.mz=-a.ox*Math.sin(a.yang)+a.oz*Math.cos(a.yang);a.ox=a.mx;a.oz=a.mz;a.my=a.oy*Math.cos(a.xang)-a.oz*Math.sin(a.xang);a.mz=a.oy*Math.sin(a.xang)+a.oz*Math.cos(a.xang);a.oy=a.my;a.oz=a.mz;a.oz-=6;a.x=div(a.ox*a.fov,a.oz)+.5;a.y=div(a.oy*a.fov,a.oz)+.5;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index2=0;a.index=0;a.q22=0;a.q21=0;a.q1=0;a.dec_med=0;a.rott=0;a.is_beat=0;a.q31=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q4=0;a.q26=0;a.p2=0;a.avg=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.p3=0;a.q3=0;a.t0=0;a.q28=0;a.q30=0;a.q20=0;a.p4=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.7,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.2+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,16);a.index2=mod(a.index2+a.is_beat*bnot(a.index),4);a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=div(a.bass_att+
a.mid_att+a.treb_att,2);a.q27=a.index+1;a.q28=a.index2;a.k1=a.is_beat*equal(mod(a.index,2),0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.1416*a.p2,4);a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.p3=a.p3*a.dec_med+(1-a.dec_med)*(100*a.index+0*a.q26);a.q30=a.p3;a.p4=a.dec_med*a.p4+(1-a.dec_med)*a.q27;a.q31=a.p4;a.zoom=1+div(a.q28,4);a.warp=0;a.dx=.2*a.q2;
return a;},pixel_eqs:''}),
"martin + stahlregen - martin in da mash 3":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":2.26,"decay":0.97,"echo_zoom":1.007,"echo_alpha":0.5,"echo_orient":3,"wave_mode":6,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"wave_a":0.001,"wave_scale":2.103,"wave_smoothing":0.54,"wave_mystery":0.38,"modwavealphastart":0.81,"modwavealphaend":1.4,"warpanimspeed":1.459,"warpscale":2.007,"fshader":0.53,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0,"wave_g":0,"wave_b":0,"ob_size":0.015,"ob_b":0.2,"ob_a":1,"ib_size":0.005,"ib_r":0,"ib_g":0,"ib_a":1,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0},"pixel_eqs":"","warp":" shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1 = ((uv * texsize.xy) * 0.08);\n  vec3 tmpvar_2;\n  tmpvar_2 = (texture (sampler_main, (uv - (\n    ((sin(tmpvar_1) / cos(tmpvar_1)) * texsize.zw)\n   * 3.0))).xyz + (vec3(dot (texture (sampler_noise_lq, \n    ((((texsize.xy * texsize_noise_lq.zw).x * uv) * 0.02) + (0.1 * rand_frame).xy)\n  ), vec4(0.32, 0.49, 0.29, 0.0))) / 30.0));\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = ((mix (tmpvar_2, \n    (1.0 - tmpvar_2.zyx)\n  , vec3(0.01, 0.01, 0.01)) - 0.03) - (0.2 * pow (\n    (1.0 - rad)\n  , 18.0)));\n  ret = tmpvar_3.xyz;\n }","comp":"vec3 xlat_mutableblur;\nvec3 xlat_mutableneu;\nvec3 xlat_mutableret1;\n shader_body { \n  vec2 uv_1;\n  float inten_3;\n  float dist_4;\n  float ang2_5;\n  vec2 uv2_6;\n  uv_1 = (uv - 0.5);\n  uv_1 = (uv_1 * aspect.xy);\n  dist_4 = 1.0;\n  inten_3 = 1.0;\n  xlat_mutableret1 = vec3(0.0, 0.0, 0.0);\n  mat2 tmpvar_7;\n  tmpvar_7[uint(0)] = _qa.xy;\n  tmpvar_7[1u] = _qa.zw;\n  uv_1 = (uv_1 * tmpvar_7);\n  for (float n_2 = 1.0; n_2 <= 6.0; n_2 += 1.0) {\n    ang2_5 = ((6.28 * n_2) / 6.0);\n    float tmpvar_8;\n    tmpvar_8 = cos(ang2_5);\n    float tmpvar_9;\n    tmpvar_9 = sin(ang2_5);\n    uv2_6.x = ((uv_1.x * tmpvar_8) - (uv_1.y * tmpvar_9));\n    uv2_6.y = ((uv_1.x * tmpvar_9) + (uv_1.y * tmpvar_8));\n    uv2_6 = (uv2_6 * aspect.yx);\n    dist_4 = (1.0 - fract((\n      (0.1666667 * n_2)\n     + q30)));\n    inten_3 = ((pow (dist_4, 0.3) * (1.0 - dist_4)) * 2.0);\n    vec2 tmpvar_10;\n    tmpvar_10 = (((2.0 * uv2_6) * dist_4) + 0.5);\n    xlat_mutableblur = ((texture (sampler_blur2, tmpvar_10).xyz * scale2) + bias2);\n    xlat_mutableneu = (texture (sampler_main, tmpvar_10).xyz + xlat_mutableblur);\n    xlat_mutableret1 = ((xlat_mutableret1 * 0.9) + (xlat_mutableneu * inten_3));\n  };\n  vec4 tmpvar_11;\n  tmpvar_11.w = 1.0;\n  tmpvar_11.xyz = (xlat_mutableret1 + (vec3(0.0, 0.0, 0.15) * rad));\n  ret = tmpvar_11.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":18,"textured":1,"rad":0.15416,"tex_ang":3.76991,"tex_zoom":5.27784,"g":1,"b":1,"a":0.7,"r2":1,"b2":1,"border_b":0,"border_a":0}},{init_eqs:function(a){
a.q1=0;
return a;},frame_eqs:function(a){
a.tex_ang=3+2*a.q1;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":32,"rad":0.06892,"tex_zoom":1.8315,"g":1,"b":1,"a":0.9,"g2":0,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){
a.q24=0;a.q22=0;
return a;},frame_eqs:function(a){
a.a=div(a.q24,2);a.a2=0;a.r=div(randint(10),10);a.g=div(randint(10),10);a.b=div(randint(10),10);a.rad=.06*a.q22;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"y":0.51,"rad":0.19869,"tex_ang":1.00531,"tex_zoom":0.49981,"g":0.4,"a":0.7,"r2":1,"b2":1,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.05+div(randint(900),1E3);a.y=.05+div(randint(900),1E3);
return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"samples":442,"thick":1,"additive":1,"scaling":0.89152,"smoothing":0}},{init_eqs:function(a){
a.q22=0;a.q24=0;a.q27=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.x=.4+.2*a.sample;a.y=.5+.01*a.value2*a.q22;a.a=.5*a.q24*mod(a.q27+1,2);a.r=.2;a.b=1;a.g=.6;
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"scaling":0.89152,"smoothing":0,"a":0.1}},{init_eqs:function(a){
a.q22=0;a.q24=0;a.q27=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.y=.4+.2*a.sample;a.x=.5+.01*a.value2*a.q22;a.a=.6*a.q24*mod(a.q27,2);a.r=.2;a.b=1;a.g=.6;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index2=0;a.pos=0;a.index=0;a.q22=0;a.q21=0;a.q15=0;a.q6=0;a.q1=0;a.dec_med=0;a.q5=0;a.movz=0;a.trel=0;a.q9=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q4=0;a.mox=0;a.q16=0;a.q26=0;a.p2=0;a.avg=0;a.trig=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.moy=0;a.p3=0;a.speed=0;a.q3=0;a.t0=0;a.q7=0;a.q28=0;a.q30=0;a.q20=0;a.q8=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.9,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,4);a.index2=mod(a.index2+a.is_beat*bnot(a.index),4);a.monitor=a.index2;a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;
a.q26=div(a.bass+a.mid+a.treb,16);a.k1=a.is_beat*bnot(a.index)*bnot(a.index2);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.p3=a.dec_med*a.p3+(1-a.dec_med)*a.p2;a.rott=div(3.1416*a.p3,4);a.pos+=div(a.q20,140);a.q28=a.pos;a.q27=a.index+1;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.trel=div(a.time,10);a.q5=Math.cos(a.trel);a.q6=Math.sin(a.trel);a.q7=-a.q6;a.q8=a.q5;a.trig=a.q24*mod(a.index,4);a.mox=bnot(a.trig)*a.mox+a.trig*(div(randint(100),100)-.5);
a.moy=bnot(a.trig)*a.moy+a.trig*(div(randint(100),100)-.5);a.q15=div(a.mox,2);a.q16=div(a.moy,2);a.speed=a.speed*bnot(a.trig)+a.trig*a.q26;a.movz+=div(a.speed,a.fps);a.q9=a.movz;a.q30=3*(1.2+Math.sin(div(a.time,7)));a.zoom=1;a.rot=-0;
return a;},pixel_eqs:''}),
"Martin - acid wiring":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.980001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":4,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken_center":1,"darken":1,"wave_a":0.001,"wave_scale":0.527429,"wave_smoothing":0.45,"modwavealphastart":0,"modwavealphaend":1.32,"warpanimspeed":0.442,"warpscale":0.498,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0.8,"wave_g":0.49,"ob_size":0,"ob_r":1,"ob_g":1,"ob_b":1,"ob_a":0.05,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0,"b1ed":0},"pixel_eqs":"","warp":" shader_body { \n  vec2 uv_1;\n  vec2 uv6_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = ((uv - 0.5) * aspect.xy);\n  float tmpvar_4;\n  tmpvar_4 = (((q28 * 2.0) * sqrt(\n    dot (tmpvar_3, tmpvar_3)\n  )) + (rand_frame * 64.0)).x;\n  uv_1 = (uv + (clamp (\n    ((sin(tmpvar_4) / cos(tmpvar_4)) * normalize(tmpvar_3))\n  , vec2(-16.0, -16.0), vec2(16.0, 16.0)) / 20.0));\n  uv6_2 = (0.4 * sin((tmpvar_3 * 12.0)));\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = (((q24 * \n    (((texture (sampler_main, uv_1).xyz - (\n      ((texture (sampler_blur1, fract(uv_1)).xyz * scale1) + bias1)\n     * 0.04)) + (0.15 * (vec3(\n      (0.1 / sqrt(dot (uv6_2, uv6_2)))\n    ) * roam_cos.xyz))) - 0.04)\n  ) * 0.98) + ((1.0 - q24) * texture (sampler_main, uv_orig).xyz));\n  ret = tmpvar_5.xyz;\n }","comp":"vec3 xlat_mutableneu;\nvec3 xlat_mutableret1;\nvec2 xlat_mutablers2;\n shader_body { \n  vec2 uv_1;\n  float inten_3;\n  float dist_4;\n  float ang2_5;\n  vec2 uv2_6;\n  uv_1 = (uv - 0.5);\n  uv_1 = (uv_1 * aspect.xy);\n  dist_4 = 1.0;\n  inten_3 = 1.0;\n  xlat_mutableret1 = vec3(0.0, 0.0, 0.0);\n  for (float n_2 = 0.0; n_2 <= 4.0; n_2 += 1.0) {\n    vec2 uv3_7;\n    ang2_5 = ((6.28 * n_2) / 4.0);\n    float tmpvar_8;\n    tmpvar_8 = cos(ang2_5);\n    float tmpvar_9;\n    tmpvar_9 = sin(ang2_5);\n    uv2_6.x = ((uv_1.x * tmpvar_8) - (uv_1.y * tmpvar_9));\n    uv2_6.y = ((uv_1.x * tmpvar_9) + (uv_1.y * tmpvar_8));\n    uv2_6 = (uv2_6 * aspect.yx);\n    dist_4 = (1.0 - fract((\n      (0.25 * n_2)\n     + q30)));\n    inten_3 = ((sqrt(dist_4) * (1.0 - dist_4)) * 4.0);\n    vec2 tmpvar_10;\n    tmpvar_10.x = tmpvar_8;\n    tmpvar_10.y = tmpvar_9;\n    uv3_7 = (fract((\n      ((3.0 * uv2_6) * dist_4)\n     + \n      (0.3 * q27)\n    )) + (q17 * tmpvar_10));\n    xlat_mutableneu = (texture (sampler_main, uv3_7).xyz - ((texture (sampler_blur2, \n      ((uv3_7 * 1.02) * q1)\n    ).xyz * scale2) + bias2));\n    xlat_mutableneu = (xlat_mutableneu * vec3(greaterThanEqual (xlat_mutableneu, vec3(0.0, 0.0, 0.0))));\n    xlat_mutableret1 = max (xlat_mutableret1, (xlat_mutableneu * inten_3));\n  };\n  xlat_mutablers2 = ((0.4 * cos(\n    ((uv_1 * 13.0) + time)\n  )) - dot (xlat_mutableret1, vec3(0.32, 0.49, 0.29)));\n  vec4 tmpvar_11;\n  tmpvar_11.w = 1.0;\n  tmpvar_11.xyz = (xlat_mutableret1 + ((\n    ((0.05 / sqrt(dot (xlat_mutablers2, xlat_mutablers2))) * q26)\n   / 4.0) * hue_shader));\n  ret = tmpvar_11.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"thickoutline":1,"textured":1,"x":0.26,"y":0.2,"rad":0.393173,"tex_zoom":1.392831,"r":0,"g":0.55,"b":0.5,"a":0.9,"g2":0.4,"b2":0.4,"border_r":0.3,"border_g":0.7,"border_b":0.8,"border_a":0.2}},{init_eqs:function(a){
a.g0=0;a.y0=0;a.q1=0;a.x0=0;a.q24=0;a.q26=0;a.r0=0;a.trig=0;a.q2=0;a.b0=0;a.rad0=0;
return a;},frame_eqs:function(a){
a.trig=a.q24;a.textured=1;a.x0=a.x0*bnot(a.trig)+a.trig*(.2+div(randint(100),200));a.y0=a.y0*bnot(a.trig)+a.trig*(.2+div(randint(100),200));a.x0+=div(.03*a.q1*(3+a.q26),a.fps);a.y0+=div(.03*a.q2*(3+a.q26),a.fps);a.x0-=Math.floor(a.x0);a.y0-=Math.floor(a.y0);a.tex_ang=a.time;a.ang=a.time*a.q2;a.x=a.x0;a.y=a.y0;a.rad0=a.rad0*bnot(a.trig)+div(a.trig*randint(100),200);a.rad=a.rad0;a.r0=a.r0*bnot(a.trig)+div(a.trig*randint(10),10);a.b0=a.b0*bnot(a.trig)+div(a.trig*randint(10),10);
a.g0=a.g0*bnot(a.trig)+div(a.trig*randint(10),10);a.border_r=a.r0;a.border_g=a.g0;a.border_b=a.b0;a.r=a.r0;a.b=a.b0;a.g=a.g0;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.rm=0;a.ampl=0;a.index2=0;a.index=0;a.q18=0;a.q22=0;a.q21=0;a.movex=0;a.q1=0;a.dec_med=0;a.index3=0;a.trel=0;a.rott=0;a.ava=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q4=0;a.q26=0;a.p2=0;a.mov=0;a.avg=0;a.movez=0;a.q19=0;a.beat=0;a.q17=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.movey=0;a.q3=0;a.t0=0;a.q28=0;a.q30=0;a.q20=0;a.dirx=1;
return a;},frame_eqs:function(a){
a.dec_med=pow(.6,div(30,a.fps));a.dec_slow=pow(.9,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.2+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,8);a.index2=mod(a.index2+a.is_beat*bnot(a.index),4);a.index3=mod(a.index3+a.is_beat*bnot(a.index)*bnot(a.index2),3);a.q20=a.avg;a.q21=
a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass+a.mid+a.treb;a.ava=a.ava*a.dec_slow+a.q26*(1-a.dec_slow);a.k1=a.is_beat*equal(mod(a.index,2),0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.1416*a.p2,2);a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.q27=8-a.index;a.q28=.5+div(Math.sin(div(a.time,7)),10);a.rm=Math.min(a.q26-1.5*a.ava,2);a.mov=a.is_beat*a.rm+(1-a.is_beat)*a.mov;a.movez+=div(.4,a.fps)*a.mov;a.q30=a.movez;a.ampl=
div(a.q26,8);a.movex+=div(.2,a.fps)*Math.sin(a.rott);a.movey+=div(.2,a.fps)*Math.cos(a.rott);a.q18=a.movex;a.q19=a.movey;a.trel=a.trel+div(1,a.fps)+a.q24;a.q17=2*Math.sin(div(a.trel,4));
return a;},pixel_eqs:''}),
"martin - basal ganglion":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.980001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":3,"additivewave":1,"wave_dots":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken":1,"wave_a":0.002217,"wave_scale":0.092461,"wave_smoothing":0,"wave_mystery":-0.2,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0,"wave_g":0,"wave_b":0,"ob_size":0,"ob_b":0.2,"ob_a":1,"ib_size":0,"ib_r":0,"ib_g":0,"ib_a":1,"mv_x":31.999998,"mv_y":24.000004,"mv_l":5,"mv_r":0.2999,"mv_g":0.4999,"mv_b":0.3999,"mv_a":0,"b1ed":0},"warp":"vec3 xlat_mutablemus;\n shader_body { \n  vec3 crisp_1;\n  float tmpvar_2;\n  tmpvar_2 = (dot (texture (sampler_noise_hq, (\n    (q30 * uv)\n   + \n    (0.001 * time)\n  )), vec4(0.32, 0.49, 0.29, 0.0)) * 3.14);\n  mat2 tmpvar_3;\n  tmpvar_3[uint(0)].x = cos(tmpvar_2);\n  tmpvar_3[uint(0)].y = sin(tmpvar_2);\n  tmpvar_3[1u].x = -(sin(tmpvar_2));\n  tmpvar_3[1u].y = cos(tmpvar_2);\n  xlat_mutablemus = (abs(vec3((0.2 / \n    (sqrt(((\n      (uv - 0.5)\n     * aspect.xy) * tmpvar_3).y) + 0.2)\n  ))) * vec3(1.0, 0.96, 0.9));\n  xlat_mutablemus = (xlat_mutablemus * (vec3(1.0, 0.96, 0.9) + (0.1 * \n    (texture (sampler_noise_lq, uv) - 0.5)\n  .xyz)));\n  vec3 tmpvar_4;\n  tmpvar_4 = ((texture (sampler_blur1, fract(uv)).xyz * scale1) + bias1);\n  vec2 tmpvar_5;\n  tmpvar_5.x = dot ((texture (sampler_main, (uv + vec2(0.004, 0.0))) - texture (sampler_main, (uv - vec2(0.004, 0.0)))), vec4(0.32, 0.49, 0.29, 0.0));\n  tmpvar_5.y = dot ((texture (sampler_main, (uv + vec2(0.0, 0.004))) - texture (sampler_main, (uv - vec2(0.0, 0.004)))), vec4(0.32, 0.49, 0.29, 0.0));\n  crisp_1 = (texture (sampler_main, (uv + (tmpvar_5 * 0.02))).xyz + (0.5 * texture (sampler_main, uv)).xyz);\n  crisp_1 = (crisp_1 * 0.667);\n  crisp_1 = (crisp_1 + (vec3(0.018, 0.018, 0.018) - (\n    sqrt(dot (tmpvar_5, tmpvar_5))\n   * tmpvar_4)));\n  vec4 tmpvar_6;\n  tmpvar_6.w = 1.0;\n  tmpvar_6.xyz = (((\n    (crisp_1 - (tmpvar_4 * 0.03))\n   + \n    (0.04 * xlat_mutablemus)\n  ) * 0.99) - 0.04);\n  ret = tmpvar_6.xyz;\n }","comp":"float xlat_mutabledist;\nfloat xlat_mutabledist2;\nfloat xlat_mutableinten;\nfloat xlat_mutablem;\nfloat xlat_mutablemask;\nvec3 xlat_mutableret1;\nvec2 xlat_mutableuv2;\n shader_body { \n  vec2 uv_1;\n  uv_1 = (uv - 0.5);\n  uv_1 = (uv_1 * aspect.xy);\n  mat2 tmpvar_2;\n  tmpvar_2[uint(0)] = _qa.xy;\n  tmpvar_2[1u] = _qa.zw;\n  uv_1 = (uv_1 * tmpvar_2);\n  int tmpvar_3;\n  tmpvar_3 = int(q10);\n  xlat_mutablem = (1.0 - float(tmpvar_3));\n  float tmpvar_4;\n  tmpvar_4 = -(q10);\n  xlat_mutabledist = (1.0 - fract((0.25 - \n    (fract(tmpvar_4) / 4.0)\n  )));\n  xlat_mutableuv2 = ((uv_1 * (float(mod (xlat_mutablem, 2.0)))) + (uv_1.yx * (float(mod (\n    (xlat_mutablem + 1.0)\n  , 2.0)))));\n  xlat_mutabledist2 = (xlat_mutabledist * xlat_mutabledist);\n  xlat_mutableinten = ((3.0 * sqrt(xlat_mutabledist)) * (1.0 - (xlat_mutabledist * xlat_mutabledist)));\n  xlat_mutableuv2 = (((\n    (4.0 * xlat_mutableuv2)\n   * xlat_mutabledist) + (0.35 * xlat_mutablem)) + (q9 * xlat_mutabledist2));\n  xlat_mutableret1 = (texture (sampler_main, xlat_mutableuv2).xyz * xlat_mutableinten);\n  xlat_mutablem = (2.0 - float(tmpvar_3));\n  xlat_mutabledist = (1.0 - fract((0.5 - \n    (fract(tmpvar_4) / 4.0)\n  )));\n  xlat_mutableuv2 = ((uv_1 * (float(mod (xlat_mutablem, 2.0)))) + (uv_1.yx * (float(mod (\n    (xlat_mutablem + 1.0)\n  , 2.0)))));\n  xlat_mutabledist2 = (xlat_mutabledist * xlat_mutabledist);\n  xlat_mutableinten = ((3.0 * sqrt(xlat_mutabledist)) * (1.0 - (xlat_mutabledist * xlat_mutabledist)));\n  xlat_mutableuv2 = (((\n    (4.0 * xlat_mutableuv2)\n   * xlat_mutabledist) + (0.35 * xlat_mutablem)) + (q9 * xlat_mutabledist2));\n  vec4 tmpvar_5;\n  tmpvar_5 = texture (sampler_main, xlat_mutableuv2);\n  xlat_mutablemask = (1.0 - ((0.9 * \n    clamp ((8.0 * xlat_mutabledist), 0.0, 1.0)\n  ) * clamp (\n    (64.0 * tmpvar_5.xyz)\n  , 0.0, 1.0))).x;\n  xlat_mutableret1 = ((xlat_mutableret1 * xlat_mutablemask) + (tmpvar_5.xyz * xlat_mutableinten));\n  xlat_mutablem = (3.0 - float(tmpvar_3));\n  xlat_mutabledist = (1.0 - fract((0.75 - \n    (fract(tmpvar_4) / 4.0)\n  )));\n  xlat_mutableuv2 = ((uv_1 * (float(mod (xlat_mutablem, 2.0)))) + (uv_1.yx * (float(mod (\n    (xlat_mutablem + 1.0)\n  , 2.0)))));\n  xlat_mutabledist2 = (xlat_mutabledist * xlat_mutabledist);\n  xlat_mutableinten = ((3.0 * sqrt(xlat_mutabledist)) * (1.0 - (xlat_mutabledist * xlat_mutabledist)));\n  xlat_mutableuv2 = (((\n    (4.0 * xlat_mutableuv2)\n   * xlat_mutabledist) + (0.35 * xlat_mutablem)) + (q9 * xlat_mutabledist2));\n  vec4 tmpvar_6;\n  tmpvar_6 = texture (sampler_main, xlat_mutableuv2);\n  xlat_mutablemask = (1.0 - ((0.9 * \n    clamp ((8.0 * xlat_mutabledist), 0.0, 1.0)\n  ) * clamp (\n    (64.0 * tmpvar_6.xyz)\n  , 0.0, 1.0))).x;\n  xlat_mutableret1 = ((xlat_mutableret1 * xlat_mutablemask) + (tmpvar_6.xyz * xlat_mutableinten));\n  xlat_mutablem = (4.0 - float(tmpvar_3));\n  xlat_mutabledist = (1.0 - fract((1.0 - \n    (fract(tmpvar_4) / 4.0)\n  )));\n  xlat_mutableuv2 = ((uv_1 * (float(mod (xlat_mutablem, 2.0)))) + (uv_1.yx * (float(mod (\n    (xlat_mutablem + 1.0)\n  , 2.0)))));\n  xlat_mutabledist2 = (xlat_mutabledist * xlat_mutabledist);\n  xlat_mutableinten = ((3.0 * sqrt(xlat_mutabledist)) * (1.0 - (xlat_mutabledist * xlat_mutabledist)));\n  xlat_mutableuv2 = (((\n    (4.0 * xlat_mutableuv2)\n   * xlat_mutabledist) + (0.35 * xlat_mutablem)) + (q9 * xlat_mutabledist2));\n  vec4 tmpvar_7;\n  tmpvar_7 = texture (sampler_main, xlat_mutableuv2);\n  xlat_mutablemask = (1.0 - ((0.9 * \n    clamp ((8.0 * xlat_mutabledist), 0.0, 1.0)\n  ) * clamp (\n    (64.0 * tmpvar_7.xyz)\n  , 0.0, 1.0))).x;\n  xlat_mutableret1 = ((xlat_mutableret1 * xlat_mutablemask) + (tmpvar_7.xyz * xlat_mutableinten));\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = (1.8 * xlat_mutableret1);\n  ret = tmpvar_8.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":15,"rad":0.084012,"tex_ang":0.5026,"tex_zoom":1.125188,"r":0.8,"b":0.8,"a":0.2,"g2":0,"a2":1,"border_r":0.7,"border_g":0,"border_b":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.5+.2*Math.sin(div(a.time,12));a.y=.5+.2*Math.cos(div(a.time,17));a.r=.5+.2*Math.sin(div(a.time,31));a.g=.5+.2*Math.sin(div(a.time,41));a.b=.5+.2*Math.sin(div(a.time,17));a.x=.5;a.y=.5;a.rad=.05;a.a=.2;a.a2=0;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":14,"additive":1,"textured":1,"x":0.59,"y":0,"rad":1.215236,"ang":0.062832,"tex_ang":0.879646,"tex_zoom":0.514935,"r":0.6,"g":0.5,"b":0.7,"a":0.1,"r2":0.7,"g2":0.5,"b2":0.6,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.5+.3*Math.cos(div(a.time,78));a.y=.5+.3*Math.sin(div(a.time,78));a.tex_zoom=div(.2,Math.sin(div(a.time,31))+1.1);
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":63,"additive":1,"textured":1,"x":0.76,"y":0.75,"rad":0.686364,"ang":0.439823,"tex_ang":0.502655,"tex_zoom":0.6159,"r":0.7,"g":0.7,"b":0.7,"a":0.15,"r2":1,"b2":1,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.5+.3*Math.cos(div(a.time,59));a.y=.5+.3*Math.sin(div(a.time,59));
return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index2=0;a.index=0;a.q22=0;a.q21=0;a.movex=0;a.q1=0;a.dec_med=0;a.q9=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q10=0;a.q4=0;a.q26=0;a.p2=0;a.avg=0;a.movez=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.p3=0;a.q3=0;a.t0=0;a.q32=0;a.q30=0;a.q20=0;a.p1=2E3;a.p2=200;a.p3=50;
return a;},frame_eqs:function(a){
a.dec_med=pow(.9,div(30,a.fps));a.dec_slow=pow(.9,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.5+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,16);a.index2=mod(a.index2+a.is_beat*bnot(a.index),5);a.monitor=a.index2;a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;
a.q26=a.bass+a.mid+a.treb;a.k1=a.is_beat*bnot(a.index)*bnot(a.index2);a.p1=a.index2-2;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.p3=a.dec_med*a.p3+(1-a.dec_med)*a.p2;a.rott+=div(.06,a.fps)*a.p3;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.movex=a.movex*a.dec_slow+div(3*a.q1,a.fps);a.q9=a.movex;a.movez+=div(.3,a.fps)*(a.p3+3);a.q10=a.movez;a.q30=.3*(Math.sin(div(a.time,45))+1.5);a.mv_x=30;a.mv_y=20;a.mv_a=.08*pow(div(30,a.fps),1)*(1+a.q22);a.mv_l=0;a.q32=pow(.98,div(30,a.fps));

return a;},pixel_eqs:function(a){
a.zoom=1;a.warp=0*(1-a.rad);a.warp=.05;
return a;}}),
"martin - bombyx mori":()=>Object.assign({"baseVals":{"rating":4,"gammaadj":1.98,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"wave_mode":6,"additivewave":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken_center":1,"darken":1,"wave_a":0.001,"wave_scale":0.236,"wave_smoothing":0,"wave_mystery":-0.64,"modwavealphastart":0.81,"modwavealphaend":1.4,"warpanimspeed":1.459,"warpscale":2.007,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0,"wave_b":0.6,"ob_size":0.005,"ob_a":0.8,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0,"b1ed":0},"pixel_eqs":"","warp":"vec3 xlat_mutablemus;\n shader_body { \n  vec2 d_1;\n  vec2 uv6_2;\n  vec2 uv1_3;\n  vec2 tmpvar_4;\n  tmpvar_4 = (uv - 0.5);\n  uv1_3 = tmpvar_4;\n  uv6_2 = tmpvar_4;\n  float x_5;\n  x_5 = (abs(tmpvar_4.x) - abs(tmpvar_4.y));\n  float tmpvar_6;\n  tmpvar_6 = (12.0 * sqrt((x_5 * x_5)));\n  vec2 tmpvar_7;\n  tmpvar_7 = normalize(tmpvar_4);\n  d_1 = tmpvar_7;\n  float tmpvar_8;\n  tmpvar_8 = (float(mod (q28, 2.0)));\n  if ((tmpvar_8 == 0.0)) {\n    d_1 = ((q1 * tmpvar_7) - (q2 / tmpvar_7));\n  };\n  uv1_3 = (tmpvar_4 + ((-0.06 * \n    dot (((texture (sampler_blur1, uv).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n  ) * normalize(tmpvar_4)));\n  uv1_3 = (uv1_3 - (clamp (\n    ((sin(tmpvar_6) / cos(tmpvar_6)) * d_1)\n  , vec2(-4.0, -4.0), vec2(4.0, 4.0)) / 60.0));\n  uv6_2 = (0.4 * cos((\n    (uv1_3 * 2.0)\n   * q28)));\n  xlat_mutablemus = (clamp (vec3((0.0006 / \n    (sqrt(dot (uv6_2, uv6_2)) - (0.002 * (q27 + (8.0 * q28))))\n  )), 0.0, 1.0) * q31);\n  xlat_mutablemus = (xlat_mutablemus * (1.0 + roam_cos).xyz);\n  vec4 tmpvar_9;\n  tmpvar_9.w = 1.0;\n  tmpvar_9.xyz = ((0.4 * (\n    ((texture (sampler_main, ((uv1_3 * \n      (0.8 + (0.2 * tmpvar_6))\n    ) + 0.5)).xyz + xlat_mutablemus) * 0.95)\n   - 0.025)) + (0.6 * texture (sampler_main, uv_orig)).xyz);\n  ret = tmpvar_9.xyz;\n }","comp":"vec3 xlat_mutableneu;\nvec3 xlat_mutableret2;\nvec2 xlat_mutablers0;\nvec2 xlat_mutablerss;\nvec2 xlat_mutableuv2;\n shader_body { \n  vec2 uv_1;\n  vec2 ofs_2;\n  vec3 ret1_3;\n  vec2 uv5_4;\n  uv_1 = ((uv - 0.5) * aspect.xy);\n  vec2 tmpvar_5;\n  tmpvar_5.x = q5;\n  tmpvar_5.y = q6;\n  uv_1 = (uv_1 + (tmpvar_5 / 4.0));\n  uv5_4 = uv_1;\n  mat2 tmpvar_6;\n  tmpvar_6[uint(0)] = _qb.xy;\n  tmpvar_6[1u] = _qb.zw;\n  uv_1 = (uv_1 * tmpvar_6);\n  float tmpvar_7;\n  float tmpvar_8;\n  tmpvar_8 = (min (abs(\n    (uv5_4.y / uv5_4.x)\n  ), 1.0) / max (abs(\n    (uv5_4.y / uv5_4.x)\n  ), 1.0));\n  float tmpvar_9;\n  tmpvar_9 = (tmpvar_8 * tmpvar_8);\n  tmpvar_9 = (((\n    ((((\n      ((((-0.01213232 * tmpvar_9) + 0.05368138) * tmpvar_9) - 0.1173503)\n     * tmpvar_9) + 0.1938925) * tmpvar_9) - 0.3326756)\n   * tmpvar_9) + 0.9999793) * tmpvar_8);\n  tmpvar_9 = (tmpvar_9 + (float(\n    (abs((uv5_4.y / uv5_4.x)) > 1.0)\n  ) * (\n    (tmpvar_9 * -2.0)\n   + 1.570796)));\n  tmpvar_7 = (tmpvar_9 * sign((uv5_4.y / uv5_4.x)));\n  if ((abs(uv5_4.x) > (1e-08 * abs(uv5_4.y)))) {\n    if ((uv5_4.x < 0.0)) {\n      if ((uv5_4.y >= 0.0)) {\n        tmpvar_7 += 3.141593;\n      } else {\n        tmpvar_7 = (tmpvar_7 - 3.141593);\n      };\n    };\n  } else {\n    tmpvar_7 = (sign(uv5_4.y) * 1.570796);\n  };\n  xlat_mutablers0.x = (((tmpvar_7 / 3.1416) * 6.0) * q28);\n  float tmpvar_10;\n  tmpvar_10 = (1.5 / sqrt(dot (uv_1, uv_1)));\n  xlat_mutablers0.y = tmpvar_10;\n  vec2 tmpvar_11;\n  tmpvar_11.x = (xlat_mutablers0.x + (q9 * 4.0));\n  tmpvar_11.y = (tmpvar_10 + ((q9 * q28) * 4.0));\n  xlat_mutablerss = (tmpvar_11 / 12.0);\n  vec2 tmpvar_12;\n  tmpvar_12.x = q5;\n  tmpvar_12.y = q6;\n  ofs_2 = (0.1 * tmpvar_12.yx);\n  float tmpvar_13;\n  float tmpvar_14;\n  tmpvar_14 = -(q9);\n  tmpvar_13 = fract(tmpvar_14);\n  mat2 tmpvar_15;\n  tmpvar_15[uint(0)].x = 1.0;\n  tmpvar_15[uint(0)].y = -0.0;\n  tmpvar_15[1u].x = 0.0;\n  tmpvar_15[1u].y = 1.0;\n  xlat_mutableuv2 = ((uv_1 * (\n    (q13 * tmpvar_13)\n   * tmpvar_15)) * aspect.yx);\n  xlat_mutableneu = (3.0 * texture (sampler_main, fract((\n    (xlat_mutableuv2 + 0.5)\n   + ofs_2)))).xyz;\n  ret1_3 = max (vec3(0.0, 0.0, 0.0), (xlat_mutableneu * (1.0 - \n    (tmpvar_13 * tmpvar_13)\n  )));\n  float tmpvar_16;\n  tmpvar_16 = fract((tmpvar_14 + 0.3333333));\n  mat2 tmpvar_17;\n  tmpvar_17[uint(0)].x = -0.4990803;\n  tmpvar_17[uint(0)].y = -0.8665558;\n  tmpvar_17[1u].x = 0.8665558;\n  tmpvar_17[1u].y = -0.4990803;\n  xlat_mutableuv2 = ((uv_1 * (\n    (q13 * tmpvar_16)\n   * tmpvar_17)) * aspect.yx);\n  xlat_mutableneu = (3.0 * texture (sampler_main, fract((\n    (xlat_mutableuv2 + 0.5)\n   + ofs_2)))).xyz;\n  ret1_3 = max (ret1_3, (xlat_mutableneu * (1.0 - \n    (tmpvar_16 * tmpvar_16)\n  )));\n  float tmpvar_18;\n  tmpvar_18 = fract((tmpvar_14 + 0.6666667));\n  mat2 tmpvar_19;\n  tmpvar_19[uint(0)].x = -0.5018377;\n  tmpvar_19[uint(0)].y = 0.8649619;\n  tmpvar_19[1u].x = -0.8649619;\n  tmpvar_19[1u].y = -0.5018377;\n  xlat_mutableuv2 = ((uv_1 * (\n    (q13 * tmpvar_18)\n   * tmpvar_19)) * aspect.yx);\n  xlat_mutableneu = (3.0 * texture (sampler_main, fract((\n    (xlat_mutableuv2 + 0.5)\n   + ofs_2)))).xyz;\n  ret1_3 = max (ret1_3, (xlat_mutableneu * (1.0 - \n    (tmpvar_18 * tmpvar_18)\n  )));\n  float tmpvar_20;\n  tmpvar_20 = fract((tmpvar_14 + 1.0));\n  mat2 tmpvar_21;\n  tmpvar_21[uint(0)].x = 0.9999949;\n  tmpvar_21[uint(0)].y = 0.003185092;\n  tmpvar_21[1u].x = -0.003185092;\n  tmpvar_21[1u].y = 0.9999949;\n  xlat_mutableuv2 = ((uv_1 * (\n    (q13 * tmpvar_20)\n   * tmpvar_21)) * aspect.yx);\n  xlat_mutableneu = (3.0 * texture (sampler_main, fract((\n    (xlat_mutableuv2 + 0.5)\n   + ofs_2)))).xyz;\n  ret1_3 = max (ret1_3, (xlat_mutableneu * (1.0 - \n    (tmpvar_20 * tmpvar_20)\n  )));\n  vec2 tmpvar_22;\n  tmpvar_22.x = (ret1_3.x + ret1_3.z);\n  tmpvar_22.y = (ret1_3.x - ret1_3.y);\n  xlat_mutableret2 = (((\n    (texture (sampler_blur1, fract((xlat_mutablerss + (tmpvar_22 / 2.0)))).xyz * scale1)\n   + bias1) / tmpvar_10) * 12.0);\n  vec4 tmpvar_23;\n  tmpvar_23.w = 1.0;\n  tmpvar_23.xyz = ((ret1_3 + (\n    ((bass_att * 0.004) / sqrt(dot (uv_1, uv_1)))\n   * roam_sin).xyz) + (sqrt(xlat_mutableret2.zxy) * clamp (\n    (1.0 - (ret1_3 * 4.0))\n  , 0.0, 1.0)));\n  ret = tmpvar_23.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":18,"num_inst":4,"x":0.83,"rad":0.14349,"tex_ang":3.76991,"tex_zoom":5.27784,"r":0,"g":1,"b":1,"a":0.5,"r2":1,"g2":0.2,"b2":1,"border_b":0,"border_a":0}},{init_eqs:function(a){
a.d=0;a.k1=0;a.q22=0;a.q27=0;a.r0=0;a.q24=0;a.g0=0;a.b0=0;
return a;},frame_eqs:function(a){
a.d=.3+.2*div(mod(a.frame,8),8);a.k1=6.28*div(a.instance,a.num_inst);a.d=.3+div(a.q22,8);a.x=.5+a.d*Math.cos(a.k1);a.y=.5+a.d*Math.sin(a.k1);a.a=Math.min(1,.2+div(.8*a.q22,2)*mod(a.q27,2));a.a2=0;a.r=.6+.4*Math.sin(div(a.time,4)+1.56);a.b=.6+.4*Math.sin(div(a.time,4)+3.14);a.g=.6+.4*Math.sin(div(a.time,4));a.r0=a.r0*bnot(a.q24)+(.5+.5*Math.sin(a.time))*a.q24;a.g0=a.g0*bnot(a.q24)+(.5+.5*Math.sin(1.7*a.time))*a.q24;a.b0=div(2-a.r0-a.g0,2);a.r=a.r0;a.b=a.b0;a.g=a.g0;a.r2=1-a.g;
a.g2=1-a.b;a.b2=1-a.r;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"samples":128,"scaling":0.89152,"smoothing":0}},{init_eqs:function(a){
a.q22=0;a.q27=0;a.q24=0;a.t1=0;a.t2=0;a.r0=0;a.g0=0;
return a;},frame_eqs:function(a){
a.t1=a.t1*bnot(a.q24)+(.5+.5*Math.sin(a.time))*a.q24;a.t2=a.t2*bnot(a.q24)+(.5+.5*Math.sin(1.7*a.time))*a.q24;
return a;},point_eqs:function(a){
a.x=a.sample;a.y=.5;a.a=a.q22*mod(a.q27+1,2);a.a=div(a.q24*mod(a.q27+1,2),2)+0;a.r=a.t1;a.b=a.t2;a.g=div(2-a.r0-a.g0,2);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index2=0;a.speed_=0;a.index=0;a.q12=0;a.q22=0;a.q21=0;a.q13=0;a.q6=0;a.q1=0;a.dec_med=0;a.q5=0;a.movz=0;a.trel=0;a.q9=0;a.rott=0;a.spg=0;a.vol__=0;a.is_beat=0;a.q31=0;a.k1=0;a.q24=0;a.vx=0;a.dec_slow=0;a.vy=0;a.vz=0;a.q4=0;a.dir=0;a.p2=0;a.avg=0;a.trig=0;a.beat=0;a.q17=0;a.vol=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.speed=0;a.q3=0;a.t0=0;a.vol_=0;a.q7=0;a.q28=0;a.q30=0;a.q20=0;a.q8=0;a.ang0=0;a.speed_=1;
return a;},frame_eqs:function(a){
a.dec_med=pow(.9,div(30,a.fps));a.dec_slow=pow(.96,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.2+a.avg+a.peak)*above(a.time,a.t0+.1);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,12);a.index2=mod(a.index2+a.is_beat*bnot(a.index),8);a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.q24=a.is_beat;a.vol=div(a.bass_att+a.mid_att+
a.treb_att,2);a.vol_=a.dec_med*a.vol_+(1-a.dec_med)*a.vol;a.vol__=a.dec_med*a.vol__+(1-a.dec_med)*a.vol_;a.q27=a.index+1;a.q28=a.index2+2;a.k1=a.is_beat*equal(mod(a.index,4),0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.1416*a.p2,4);a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.trig=a.q24*bnot(mod(a.index,8));a.vx=a.vx*bnot(a.trig)+a.trig*(div(randint(100),100)-.5);a.vy=a.vy*bnot(a.trig)+a.trig*(div(randint(100),100)-.5);a.vz=a.vz*bnot(a.trig)+
a.trig*(div(randint(100),100)-.5);a.speed=Math.min(a.vol_-a.vol__+.5,1);a.speed=Math.max(a.speed,-.5);a.speed_=bnot(a.trig)*a.speed_+a.trig*a.speed;a.spg=a.dec_med*a.spg+(1-a.dec_med)*a.speed_;a.movz+=div(1,a.fps)*(a.speed_+div(0*a.vol_,6));a.q9=a.movz;a.q12=2*Math.min(a.q22,6);a.q13=2*Math.sin(div(a.movz,3)-div(a.time,11));a.trig=bnot(mod(a.index,4))*a.q24;a.dir=bnot(a.trig)*a.dir+a.trig*(randint(10)-5);a.trel+=div(.1,a.fps)*a.dir;a.q5=Math.cos(a.trel-a.movz);a.q6=Math.sin(div(a.trel,2)-a.movz);
a.q7=-a.q6;a.q8=a.q5;a.ang0=a.ang0*a.dec_med+a.vz*(1-a.dec_med);a.q17=2*a.ang0;a.q30=.2*Math.sin(div(a.time,8));a.q31=.5+.5*Math.sin(div(a.time,3.3));a.zoom=1;a.rot=0;a.dx=0;a.monitor=a.q28;
return a;},pixel_eqs:''}),
"martin - bring up the big guns":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.980001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":4,"modwavealphabyvolume":1,"darken":1,"wave_a":0.002705,"wave_scale":1.291486,"wave_smoothing":0.45,"wave_mystery":0.08,"modwavealphastart":0,"modwavealphaend":1.32,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0,"wave_g":0.99,"ob_size":0.025,"ob_r":1,"ob_g":1,"ob_b":1,"ib_size":0.11,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0,"b1x":0.6999,"b1ed":0},"warp":" shader_body { \n  vec2 uv_1;\n  vec2 uv6_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = (uv - vec2(0.5, 0.5));\n  float x_4;\n  x_4 = (tmpvar_3.x * tmpvar_3.y);\n  float tmpvar_5;\n  tmpvar_5 = (64.0 * sqrt((x_4 * x_4)));\n  vec2 tmpvar_6;\n  tmpvar_6 = normalize(tmpvar_3);\n  uv_1 = (uv + ((q28 * tmpvar_6) * (1.0 - \n    ((1.0/(tmpvar_5)) * (q2 + 1.0))\n  )));\n  uv_1 = (uv_1 - ((\n    clamp (((sin(tmpvar_5) / cos(tmpvar_5)) * tmpvar_6), vec2(-2.0, -2.0), vec2(2.0, 2.0))\n   / 20.0) * rad));\n  uv6_2 = (0.2 * cos((\n    (uv_1 * 32.0)\n   + \n    (rand_frame * 6.0)\n  .xy)));\n  vec4 tmpvar_7;\n  tmpvar_7.w = 1.0;\n  tmpvar_7.xyz = (((texture (sampler_main, \n    (((uv_1 - 0.5) * (0.95 + (0.1 * tmpvar_5))) + 0.5)\n  ).xyz + vec3(\n    ((0.002 / (sqrt(\n      dot (uv6_2, uv6_2)\n    ) - 0.004)) * (1.0 - rad))\n  )) * 0.94) - 0.01);\n  ret = tmpvar_7.xyz;\n }","comp":"vec2 xlat_mutablers;\n shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1.x = q7;\n  tmpvar_1.y = q8;\n  vec2 tmpvar_2;\n  tmpvar_2 = (((uv - 0.5) - tmpvar_1) * aspect.xy);\n  vec2 tmpvar_3;\n  tmpvar_3.x = q5;\n  tmpvar_3.y = q6;\n  xlat_mutablers = (((uv_orig - 0.5) - tmpvar_3) * aspect.xy);\n  float tmpvar_4;\n  tmpvar_4 = (((22.0 * \n    sqrt(dot (xlat_mutablers, xlat_mutablers))\n  ) * q32) - 0.1);\n  vec2 tmpvar_5;\n  tmpvar_5.x = q15;\n  tmpvar_5.y = q16;\n  vec2 tmpvar_6;\n  tmpvar_6 = fract(((\n    (tmpvar_2 * (1.0 - pow (sqrt(\n      dot (tmpvar_2, tmpvar_2)\n    ), 3.0)))\n   - 0.5) - (\n    (texture (sampler_noise_hq, (((0.1 * \n      (sin(tmpvar_4) / cos(tmpvar_4))\n    ) * normalize(xlat_mutablers)) + tmpvar_5)).xyz * 0.04)\n   * \n    clamp ((10.0 - (7.0 * tmpvar_4)), 0.0, 1.0)\n  ).xy));\n  vec4 tmpvar_7;\n  tmpvar_7.w = 1.0;\n  tmpvar_7.xyz = ((1.5 * texture (sampler_main, tmpvar_6).xyz) + ((texture (sampler_blur1, tmpvar_6).xyz * scale1) + bias1));\n  ret = tmpvar_7.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":44,"rad":0.108525,"tex_ang":1.00531,"tex_zoom":1.531168,"g":1,"b":1,"r2":0.83,"g2":0.93,"b2":0.8,"border_b":0,"border_a":0}},{init_eqs:function(a){
a.g0=0;a.cmax=0;a.q24=0;a.q11=0;a.q10=0;a.r0=0;a.trig=0;a.q27=0;a.dist=0;a.b0=0;
return a;},frame_eqs:function(a){
a.trig=a.q24*equal(mod(a.q27,4),0);a.dist=bnot(a.trig)*(a.dist+div(a.q10,a.fps));a.x=.5-div(div(1,a.dist+1),2);a.y=1-a.x;a.r0=bnot(a.trig)*a.r0+div(a.trig*randint(100),100);a.g0=bnot(a.trig)*a.g0+div(a.trig*randint(100),100);a.b0=bnot(a.trig)*a.b0+div(a.trig*randint(100),100);a.cmax=Math.max(Math.max(a.r0,a.g0),a.b0);a.r=div(a.r0,a.cmax);a.r2=a.r;a.g=div(a.g0,a.cmax);a.g2=a.g;a.b=div(a.b0,a.cmax);a.b2=a.b;a.rad=div(a.q11,a.dist+1);a.a=div(1,1+div(a.dist,4));a.a2=0;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":34,"thickoutline":1,"x":0.4,"rad":2.366958,"tex_ang":3.455753,"tex_zoom":0.993053,"r":0.5,"b":1,"a":0.2,"r2":0.7,"g2":0.4,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){
a.g0=0;a.cmax=0;a.q24=0;a.q11=0;a.q10=0;a.r0=0;a.trig=0;a.q27=0;a.dist=0;a.b0=0;
return a;},frame_eqs:function(a){
a.trig=a.q24*equal(mod(a.q27,4),2);a.dist=bnot(a.trig)*(a.dist+div(a.q10,a.fps));a.x=.5+div(div(1,a.dist+1),1.9);a.y=1-a.x;a.r0=bnot(a.trig)*a.r0+div(a.trig*randint(100),100);a.g0=bnot(a.trig)*a.g0+div(a.trig*randint(100),100);a.b0=bnot(a.trig)*a.b0+div(a.trig*randint(100),100);a.cmax=Math.max(Math.max(a.r0,a.g0),a.b0);a.r=div(a.r0,a.cmax);a.r2=a.r;a.g=div(a.g0,a.cmax);a.g2=a.g;a.b=div(a.b0,a.cmax);a.b2=a.b;a.rad=div(a.q11,a.dist+1);a.a=div(1,1+div(a.dist,4));a.a2=0;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":44,"x":0.503,"rad":0.038857,"tex_zoom":0.609857,"g":0.1,"a":0.9,"r2":1,"b2":1,"border_a":0}},{init_eqs:function(a){
a.g0=0;a.cmax=0;a.q24=0;a.q11=0;a.q10=0;a.r0=0;a.trig=0;a.q27=0;a.dist=0;a.b0=0;
return a;},frame_eqs:function(a){
a.trig=a.q24*equal(mod(a.q27,4),1);a.dist=bnot(a.trig)*(a.dist+div(a.q10,a.fps));a.x=.5-div(div(1,a.dist+1),1.9);a.y=a.x;a.r0=bnot(a.trig)*a.r0+div(a.trig*randint(100),100);a.g0=bnot(a.trig)*a.g0+div(a.trig*randint(100),100);a.b0=bnot(a.trig)*a.b0+div(a.trig*randint(100),100);a.cmax=Math.max(Math.max(a.r0,a.g0),a.b0);a.r=div(a.r0,a.cmax);a.r2=a.r;a.g=div(a.g0,a.cmax);a.g2=a.g;a.b=div(a.b0,a.cmax);a.b2=a.b;a.rad=div(a.q11,a.dist+1);a.a=div(1,1+div(a.dist,4));a.a2=0;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":63,"y":1,"rad":0.548217,"tex_zoom":2.223327,"g":1,"b":1,"r2":1,"b2":1,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){
a.g0=0;a.cmax=0;a.q24=0;a.q11=0;a.q10=0;a.r0=0;a.trig=0;a.q27=0;a.dist=0;a.b0=0;
return a;},frame_eqs:function(a){
a.trig=a.q24*equal(mod(a.q27,4),3);a.dist=bnot(a.trig)*(a.dist+div(a.q10,a.fps));a.x=.5+div(div(1,a.dist+1),1.9);a.y=a.x;a.r0=bnot(a.trig)*a.r0+div(a.trig*randint(100),100);a.g0=bnot(a.trig)*a.g0+div(a.trig*randint(100),100);a.b0=bnot(a.trig)*a.b0+div(a.trig*randint(100),100);a.cmax=Math.max(Math.max(a.r0,a.g0),a.b0);a.r=div(a.r0,a.cmax);a.r2=a.r;a.g=div(a.g0,a.cmax);a.g2=a.g;a.b=div(a.b0,a.cmax);a.b2=a.b;a.rad=div(a.q11,a.dist+1);a.a=div(1,1+div(a.dist,4));a.a2=0;
return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.px=0;a.index2=0;a.index=0;a.q22=0;a.q21=0;a.q15=0;a.q29=0;a.q6=0;a.ppx=0;a.q1=0;a.dec_med=0;a.q5=0;a.py=0;a.index3=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q11=0;a.q10=0;a.q4=0;a.q16=0;a.q26=0;a.p2=0;a.avg=0;a.puls=0;a.beat=0;a.trel2=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.trel1=0;a.q3=0;a.roty=0;a.t0=0;a.q32=0;a.ppy=0;a.q7=0;a.q28=0;a.rotx=0;a.q20=0;a.q8=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.5,div(30,a.fps));a.dec_slow=pow(.9,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.2+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,8);a.index2=mod(a.index2+a.is_beat*bnot(a.index),2);a.index3=mod(a.index3+a.is_beat*bnot(a.index)*bnot(a.index2),3);a.q20=a.avg;a.q21=
a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass_att+a.mid_att+a.treb_att;a.q27=a.index+1;a.q28=div(-a.index2,100);a.q29=bnot(below(a.index2+a.index3,1));a.puls=a.dec_slow*a.puls+(1-a.dec_slow)*a.q29;a.q32=a.puls;a.k1=a.is_beat*equal(mod(a.index,2),0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.1416*a.p2,4);a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.trel1+=div(4.2*a.q1,a.fps)*a.q22;a.trel2+=1*div(3*a.q2,a.fps);a.px=.2*
Math.sin(a.trel1);a.py=.1*Math.cos(a.trel2);a.q5=a.px;a.q6=a.py;a.rotx+=4*div(a.q5,a.fps);a.roty+=4*div(a.q6,a.fps);a.q15=a.rotx;a.q16=a.roty;a.ppx=a.ppx*a.dec_slow+(1-a.dec_slow)*a.px;a.ppy=a.ppy*a.dec_slow+(1-a.dec_slow)*a.py;a.q7=a.ppx;a.q8=a.ppy;a.q10=20;a.q11=.8;a.zoom=1;a.dy=0;a.dx=0;a.warp=.1;
return a;},pixel_eqs:function(a){
a.rot=.05*a.q1*(1-a.rad);
return a;}}),
"Martin - cool morning":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.780001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":7,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken":1,"wave_a":0.001,"wave_scale":0.958178,"wave_smoothing":0.45,"modwavealphastart":0,"modwavealphaend":1.32,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"ob_size":0.06,"ob_r":1,"ob_g":1,"ob_b":1,"ib_size":0.26,"mv_x":25.599995,"mv_y":9.600006,"mv_l":0,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0,"b1x":0.6999,"b1ed":0},"pixel_eqs":"","warp":" shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1 = ((uv * texsize.xy) * (0.01 * q28));\n  vec2 tmpvar_2;\n  tmpvar_2.x = (cos((tmpvar_1.y * q1)) * sin(-(tmpvar_1.y)));\n  tmpvar_2.y = (sin(tmpvar_1.x) * cos((tmpvar_1.y * q2)));\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = ((texture (sampler_main, (uv - \n    ((tmpvar_2 * texsize.zw) * 18.0)\n  )).xyz * 0.99) - 0.01);\n  ret = tmpvar_3.xyz;\n }","comp":"vec2 xlat_mutabledz;\nvec3 xlat_mutableret1;\nvec2 xlat_mutableuv3;\nvec2 xlat_mutableuv4;\n shader_body { \n  vec2 uv_1;\n  float inten_2;\n  float dist_3;\n  vec3 ret_4;\n  uv_1 = (uv - 0.5);\n  float tmpvar_5;\n  tmpvar_5 = (time / 4.0);\n  dist_3 = (1.0 - fract(tmpvar_5));\n  inten_2 = ((sqrt(dist_3) * (1.0 - dist_3)) * 2.0);\n  vec2 tmpvar_6;\n  tmpvar_6.y = 0.0;\n  float tmpvar_7;\n  tmpvar_7 = (time / 8.0);\n  tmpvar_6.x = tmpvar_7;\n  xlat_mutableuv3 = (((\n    (2.0 * uv_1)\n   * dist_3) + 0.4) + tmpvar_6);\n  vec2 tmpvar_8;\n  tmpvar_8.y = 0.0;\n  tmpvar_8.x = texsize.z;\n  vec2 tmpvar_9;\n  tmpvar_9.y = 0.0;\n  tmpvar_9.x = texsize.z;\n  xlat_mutabledz.x = (inten_2 * dot ((texture (sampler_main, \n    (xlat_mutableuv3 + tmpvar_8)\n  ).xyz - texture (sampler_main, \n    (xlat_mutableuv3 - tmpvar_9)\n  ).xyz), vec3(0.32, 0.49, 0.29)));\n  vec2 tmpvar_10;\n  tmpvar_10.x = 0.0;\n  tmpvar_10.y = texsize.w;\n  vec2 tmpvar_11;\n  tmpvar_11.x = 0.0;\n  tmpvar_11.y = texsize.w;\n  xlat_mutabledz.y = (inten_2 * dot ((texture (sampler_main, \n    (xlat_mutableuv3 + tmpvar_10)\n  ).xyz - texture (sampler_main, \n    (xlat_mutableuv3 - tmpvar_11)\n  ).xyz), vec3(0.32, 0.49, 0.29)));\n  xlat_mutableret1 = max (vec3(0.0, 0.0, 0.0), (texture (sampler_main, xlat_mutableuv3).xyz * inten_2));\n  dist_3 = (1.0 - fract((0.2 + tmpvar_5)));\n  inten_2 = ((sqrt(dist_3) * (1.0 - dist_3)) * 2.0);\n  vec2 tmpvar_12;\n  tmpvar_12.y = 0.0;\n  tmpvar_12.x = tmpvar_7;\n  xlat_mutableuv3 = (((\n    (2.0 * uv_1)\n   * dist_3) + 0.4) + tmpvar_12);\n  vec2 tmpvar_13;\n  tmpvar_13.y = 0.0;\n  tmpvar_13.x = texsize.z;\n  vec2 tmpvar_14;\n  tmpvar_14.y = 0.0;\n  tmpvar_14.x = texsize.z;\n  xlat_mutabledz.x = (xlat_mutabledz.x + (inten_2 * dot (\n    (texture (sampler_main, (xlat_mutableuv3 + tmpvar_13)).xyz - texture (sampler_main, (xlat_mutableuv3 - tmpvar_14)).xyz)\n  , vec3(0.32, 0.49, 0.29))));\n  vec2 tmpvar_15;\n  tmpvar_15.x = 0.0;\n  tmpvar_15.y = texsize.w;\n  vec2 tmpvar_16;\n  tmpvar_16.x = 0.0;\n  tmpvar_16.y = texsize.w;\n  xlat_mutabledz.y = (xlat_mutabledz.y + (inten_2 * dot (\n    (texture (sampler_main, (xlat_mutableuv3 + tmpvar_15)).xyz - texture (sampler_main, (xlat_mutableuv3 - tmpvar_16)).xyz)\n  , vec3(0.32, 0.49, 0.29))));\n  xlat_mutableret1 = max (xlat_mutableret1, (texture (sampler_main, xlat_mutableuv3).xyz * inten_2));\n  dist_3 = (1.0 - fract((0.4 + tmpvar_5)));\n  inten_2 = ((sqrt(dist_3) * (1.0 - dist_3)) * 2.0);\n  vec2 tmpvar_17;\n  tmpvar_17.y = 0.0;\n  tmpvar_17.x = tmpvar_7;\n  xlat_mutableuv3 = (((\n    (2.0 * uv_1)\n   * dist_3) + 0.4) + tmpvar_17);\n  vec2 tmpvar_18;\n  tmpvar_18.y = 0.0;\n  tmpvar_18.x = texsize.z;\n  vec2 tmpvar_19;\n  tmpvar_19.y = 0.0;\n  tmpvar_19.x = texsize.z;\n  xlat_mutabledz.x = (xlat_mutabledz.x + (inten_2 * dot (\n    (texture (sampler_main, (xlat_mutableuv3 + tmpvar_18)).xyz - texture (sampler_main, (xlat_mutableuv3 - tmpvar_19)).xyz)\n  , vec3(0.32, 0.49, 0.29))));\n  vec2 tmpvar_20;\n  tmpvar_20.x = 0.0;\n  tmpvar_20.y = texsize.w;\n  vec2 tmpvar_21;\n  tmpvar_21.x = 0.0;\n  tmpvar_21.y = texsize.w;\n  xlat_mutabledz.y = (xlat_mutabledz.y + (inten_2 * dot (\n    (texture (sampler_main, (xlat_mutableuv3 + tmpvar_20)).xyz - texture (sampler_main, (xlat_mutableuv3 - tmpvar_21)).xyz)\n  , vec3(0.32, 0.49, 0.29))));\n  xlat_mutableret1 = max (xlat_mutableret1, (texture (sampler_main, xlat_mutableuv3).xyz * inten_2));\n  dist_3 = (1.0 - fract((0.6 + tmpvar_5)));\n  inten_2 = ((sqrt(dist_3) * (1.0 - dist_3)) * 2.0);\n  vec2 tmpvar_22;\n  tmpvar_22.y = 0.0;\n  tmpvar_22.x = tmpvar_7;\n  xlat_mutableuv3 = (((\n    (2.0 * uv_1)\n   * dist_3) + 0.4) + tmpvar_22);\n  vec2 tmpvar_23;\n  tmpvar_23.y = 0.0;\n  tmpvar_23.x = texsize.z;\n  vec2 tmpvar_24;\n  tmpvar_24.y = 0.0;\n  tmpvar_24.x = texsize.z;\n  xlat_mutabledz.x = (xlat_mutabledz.x + (inten_2 * dot (\n    (texture (sampler_main, (xlat_mutableuv3 + tmpvar_23)).xyz - texture (sampler_main, (xlat_mutableuv3 - tmpvar_24)).xyz)\n  , vec3(0.32, 0.49, 0.29))));\n  vec2 tmpvar_25;\n  tmpvar_25.x = 0.0;\n  tmpvar_25.y = texsize.w;\n  vec2 tmpvar_26;\n  tmpvar_26.x = 0.0;\n  tmpvar_26.y = texsize.w;\n  xlat_mutabledz.y = (xlat_mutabledz.y + (inten_2 * dot (\n    (texture (sampler_main, (xlat_mutableuv3 + tmpvar_25)).xyz - texture (sampler_main, (xlat_mutableuv3 - tmpvar_26)).xyz)\n  , vec3(0.32, 0.49, 0.29))));\n  xlat_mutableret1 = max (xlat_mutableret1, (texture (sampler_main, xlat_mutableuv3).xyz * inten_2));\n  uv_1 = (uv_1 + (xlat_mutabledz * 14.0));\n  xlat_mutableuv4 = (uv_1 - vec2(0.2, -0.1));\n  float tmpvar_27;\n  tmpvar_27 = (0.5 * clamp ((1.0/(\n    (abs(uv_1.y) + 0.1)\n  )), 0.0, 12.0));\n  vec2 tmpvar_28;\n  tmpvar_28.x = (uv_1.x * tmpvar_27);\n  tmpvar_28.y = tmpvar_27;\n  vec3 tmpvar_29;\n  tmpvar_29.xy = vec2(0.0, 0.0);\n  tmpvar_29.z = clamp ((1.0 - (3.0 * uv_1.y)), 0.0, 1.0);\n  ret_4 = (vec3(0.0, 0.1, 0.1) + (0.1 * tmpvar_29));\n  ret_4 = (ret_4 + (vec3(dot (texture (sampler_noise_hq, \n    (tmpvar_28 + (0.04 * time))\n  ), vec4(0.32, 0.49, 0.29, 0.0))) * (\n    (clamp ((1.0 - (12.0 * uv_1.y)), 0.0, 1.0) * 0.1)\n   / \n    (0.03 + sqrt(dot (xlat_mutableuv4, xlat_mutableuv4)))\n  )));\n  ret_4 = (ret_4 + ((0.4 * xlat_mutableret1) + (xlat_mutableret1 * q22)));\n  vec4 tmpvar_30;\n  tmpvar_30.w = 1.0;\n  tmpvar_30.xyz = ret_4;\n  ret = tmpvar_30.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":100,"rad":0.040123,"tex_ang":1.00531,"tex_zoom":1.531168,"r":0.5,"g":1,"b":0.9,"a":0.5,"r2":0.83,"g2":0.93,"b2":0.8,"border_b":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.5+.4*Math.sin(div(a.time,3));a.y=.5+.4*Math.sin(div(a.time,4));
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":100,"additive":1,"x":0.26,"y":0.2,"rad":0.393173,"tex_zoom":0.9355,"r":0,"g":0.55,"b":0.5,"g2":0.4,"b2":0.4,"a2":0.07,"border_r":0.3,"border_g":0.7,"border_b":0.8,"border_a":0}},{init_eqs:function(a){
a.g0=0;a.y0=0;a.q1=0;a.x0=0;a.q24=0;a.r0=0;a.trig=0;a.q2=0;a.b0=0;a.rad0=0;
return a;},frame_eqs:function(a){
a.trig=a.q24;a.x0=a.x0*bnot(a.trig)+a.trig*(.5+div(randint(100),200));a.y0=a.y0*bnot(a.trig)+a.trig*(.5+div(randint(100),200));a.x0+=div(.3*a.q1,a.fps);a.y0+=div(.3*a.q2,a.fps);a.x0-=Math.floor(a.x0);a.y0-=Math.floor(a.y0);a.x=a.x0;a.y=a.y0;a.rad0=a.rad0*bnot(a.trig)+a.trig*(.01+div(randint(100),800));a.rad=a.rad0;a.r0=bnot(a.trig)*a.r0+div(a.trig*randint(10),10);a.g0=bnot(a.trig)*a.g0+div(a.trig*randint(10),10);a.b0=bnot(a.trig)*a.b0+div(a.trig*randint(10),10);a.r=a.r0;a.b=
a.b0;a.g=a.g0;a.r2=a.b;a.b2=a.g;a.g2=a.r;a.a=.4;a.a2=0;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":44,"additive":1,"x":0.503,"rad":0.038857,"tex_zoom":0.609857,"g":0.1,"a":0.9,"r2":1,"b2":1,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){
a.g0=0;a.y0=0;a.q1=0;a.x0=0;a.q24=0;a.r0=0;a.trig=0;a.q2=0;a.b0=0;a.rad0=0;
return a;},frame_eqs:function(a){
a.trig=a.q24;a.x0=a.x0*bnot(a.trig)+a.trig*(.5+div(randint(100),200));a.y0=a.y0*bnot(a.trig)+a.trig*(.5+div(randint(100),200));a.x0+=div(.3*a.q1,a.fps);a.y0+=div(.3*a.q2,a.fps);a.x0-=Math.floor(a.x0);a.y0-=Math.floor(a.y0);a.x=a.x0;a.y=a.y0;a.rad0=a.rad0*bnot(a.trig)+a.trig*(.04+div(randint(100),800));a.rad=a.rad0;a.r0=bnot(a.trig)*a.r0+div(a.trig*randint(10),10);a.g0=bnot(a.trig)*a.g0+div(a.trig*randint(10),10);a.b0=bnot(a.trig)*a.b0+div(a.trig*randint(10),10);a.r=a.r0;a.b=
a.b0;a.g=a.g0;a.r2=0;a.b2=0;a.g2=0;a.a=.4;a.a2=0;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.ready=0;a.index2=0;a.uu=0;a.index=0;a.q22=0;a.q21=0;a.q29=0;a.movex=0;a.q1=0;a.oo=0;a.dec_med=0;a.index3=0;a.rott=0;a.is_beat=0;a.q31=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q4=0;a.is_beat2=0;a.q26=0;a.p2=0;a.avg=0;a.movez=0;a.q19=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.q3=0;a.t0=0;a.q32=0;a.q28=0;a.q20=0;a.index4=randint(2);a.index3=randint(4);a.oo=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.9,div(30,a.fps));a.dec_slow=pow(.96,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.5+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,4);a.index2=mod(a.index2+a.is_beat*bnot(a.index),6);a.index3=mod(a.index3+a.is_beat*bnot(a.index)*bnot(a.index2),4);a.q20=a.avg;a.q21=
a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass+a.mid+a.treb;a.ready=a.is_beat*bnot(a.ready)+bnot(a.is_beat2)*a.ready;a.is_beat2=a.ready*above(a.time,a.t0+.2);a.q19=a.is_beat2;a.k1=a.is_beat*equal(a.index,0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.14159265359*a.p2,4);a.q27=a.index+1;a.q28=a.index2;a.q29=4*a.index3+1;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.movez+=div(.3,a.fps);a.q31=a.movez;a.movex+=div(.3,a.fps)*
a.q2;a.q32=a.movex;a.uu=a.dec_slow*a.uu+(1-a.dec_slow)*equal(a.index2,0);a.rot=.1*a.uu;a.oo=a.dec_slow*a.oo+(1-a.dec_slow)*below(a.index2,3);a.mv_a=.1*a.oo;
return a;},pixel_eqs:''}),
"martin - dark galaxy":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.980001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"darken":1,"wave_a":0.001,"wave_scale":2.232543,"wave_smoothing":0.81,"wave_mystery":0.28,"modwavealphastart":0.47,"modwavealphaend":1.32,"warpanimspeed":0.01,"warpscale":0.01,"zoom":1.001832,"dx":1,"warp":0.01,"sx":0.999997,"wave_r":0,"wave_g":0,"wave_b":0,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0,"b1ed":0},"pixel_eqs":"","warp":" shader_body { \n  vec2 uv_1;\n  vec2 uv6_2;\n  vec3 ret_3;\n  vec2 tmpvar_4;\n  tmpvar_4 = ((uv - 0.5) * aspect.xy);\n  float tmpvar_5;\n  tmpvar_5 = (sqrt(dot (tmpvar_4, tmpvar_4)) + (rand_frame * 116.0)).x;\n  uv_1 = (uv + ((\n    ((texture (sampler_blur1, uv).xyz * scale1) + bias1)\n  .xy * vec2(0.0, 1.0)) + (0.01 * \n    clamp (((sin(tmpvar_5) / cos(tmpvar_5)) * normalize(tmpvar_4)), vec2(-18.0, -18.0), vec2(18.0, 18.0))\n  )));\n  uv6_2 = (0.4 * sin((\n    ((tmpvar_4 * 2.0) * q27)\n   + rand_frame.xy)));\n  ret_3 = ((q24 * (\n    (((texture (sampler_main, (0.95 + uv_1)).xyz - (\n      ((texture (sampler_blur2, fract(uv_1)).xyz * scale2) + bias2)\n     * 0.03)) + (0.2 * (vec3(\n      (0.051 / sqrt(dot (uv6_2, uv6_2)))\n    ) * roam_sin.xyz))) * 0.95)\n   - 0.02)) + ((1.0 - q24) * texture (sampler_main, uv_orig).xyz));\n  ret_3 = (ret_3 * q32);\n  vec4 tmpvar_6;\n  tmpvar_6.w = 1.0;\n  tmpvar_6.xyz = ret_3;\n  ret = tmpvar_6.xyz;\n }","comp":"vec2 xlat_mutabledz;\nvec3 xlat_mutablemus;\nvec3 xlat_mutableneu;\nvec3 xlat_mutableret1;\nvec2 xlat_mutableuv3;\n shader_body { \n  float inten_1;\n  float dist_2;\n  vec2 uv2_3;\n  vec3 ret_4;\n  vec2 tmpvar_5;\n  tmpvar_5.y = 0.0;\n  tmpvar_5.x = texsize.z;\n  vec2 tmpvar_6;\n  tmpvar_6.x = 0.0;\n  tmpvar_6.y = texsize.w;\n  xlat_mutabledz.x = dot ((texture (sampler_main, (uv + tmpvar_5)).xyz - texture (sampler_main, (uv - tmpvar_5)).xyz), vec3(0.32, 0.49, 0.29));\n  xlat_mutabledz.y = dot ((texture (sampler_main, (uv + tmpvar_6)).xyz - texture (sampler_main, (uv - tmpvar_6)).xyz), vec3(0.32, 0.49, 0.29));\n  xlat_mutablemus = (texture (sampler_main, (uv + (0.03 * xlat_mutabledz))).xyz + 0.02);\n  uv2_3 = (uv - 0.5);\n  float tmpvar_7;\n  tmpvar_7 = (time / 4.0);\n  dist_2 = (1.0 - fract(tmpvar_7));\n  float tmpvar_8;\n  tmpvar_8 = (1.0 - rad);\n  inten_1 = (((\n    sqrt(dist_2)\n   * \n    (1.0 - (dist_2 * dist_2))\n  ) * 8.0) * tmpvar_8);\n  xlat_mutableuv3 = (((2.0 * uv2_3) * dist_2) + 0.6);\n  vec2 tmpvar_9;\n  tmpvar_9 = fract(xlat_mutableuv3);\n  xlat_mutabledz.x = (texture (sampler_main, (tmpvar_9 + tmpvar_5)).xyz - texture (sampler_main, (tmpvar_9 - tmpvar_5)).xyz).x;\n  xlat_mutabledz.y = (texture (sampler_main, (tmpvar_9 + tmpvar_6)).xyz - texture (sampler_main, (tmpvar_9 - tmpvar_6)).xyz).x;\n  xlat_mutableneu = ((dist_2 * texture (sampler_main, tmpvar_9).xyz) + ((1.0 - dist_2) * dot (\n    ((texture (sampler_blur2, tmpvar_9).xyz * scale2) + bias2)\n  , vec3(0.32, 0.49, 0.29))));\n  xlat_mutableret1 = max (vec3(0.0, 0.0, 0.0), (xlat_mutableneu * inten_1));\n  dist_2 = (1.0 - fract((0.3333333 + tmpvar_7)));\n  inten_1 = (((\n    sqrt(dist_2)\n   * \n    (1.0 - (dist_2 * dist_2))\n  ) * 8.0) * tmpvar_8);\n  xlat_mutableuv3 = (((2.0 * uv2_3) * dist_2) + 0.6);\n  vec2 tmpvar_10;\n  tmpvar_10 = fract(xlat_mutableuv3);\n  xlat_mutabledz.x = (xlat_mutabledz.x + (texture (sampler_main, (tmpvar_10 + tmpvar_5)).xyz - texture (sampler_main, (tmpvar_10 - tmpvar_5)).xyz).x);\n  xlat_mutabledz.y = (xlat_mutabledz.y + (texture (sampler_main, (tmpvar_10 + tmpvar_6)).xyz - texture (sampler_main, (tmpvar_10 - tmpvar_6)).xyz).x);\n  xlat_mutableneu = ((dist_2 * texture (sampler_main, tmpvar_10).xyz) + ((1.0 - dist_2) * dot (\n    ((texture (sampler_blur2, tmpvar_10).xyz * scale2) + bias2)\n  , vec3(0.32, 0.49, 0.29))));\n  xlat_mutableret1 = max (xlat_mutableret1, (xlat_mutableneu * inten_1));\n  dist_2 = (1.0 - fract((0.6666667 + tmpvar_7)));\n  inten_1 = (((\n    sqrt(dist_2)\n   * \n    (1.0 - (dist_2 * dist_2))\n  ) * 8.0) * tmpvar_8);\n  xlat_mutableuv3 = (((2.0 * uv2_3) * dist_2) + 0.6);\n  vec2 tmpvar_11;\n  tmpvar_11 = fract(xlat_mutableuv3);\n  xlat_mutabledz.x = (xlat_mutabledz.x + (texture (sampler_main, (tmpvar_11 + tmpvar_5)).xyz - texture (sampler_main, (tmpvar_11 - tmpvar_5)).xyz).x);\n  xlat_mutabledz.y = (xlat_mutabledz.y + (texture (sampler_main, (tmpvar_11 + tmpvar_6)).xyz - texture (sampler_main, (tmpvar_11 - tmpvar_6)).xyz).x);\n  xlat_mutableneu = ((dist_2 * texture (sampler_main, tmpvar_11).xyz) + ((1.0 - dist_2) * dot (\n    ((texture (sampler_blur2, tmpvar_11).xyz * scale2) + bias2)\n  , vec3(0.32, 0.49, 0.29))));\n  xlat_mutableret1 = max (xlat_mutableret1, (xlat_mutableneu * inten_1));\n  dist_2 = (1.0 - fract((1.0 + tmpvar_7)));\n  inten_1 = (((\n    sqrt(dist_2)\n   * \n    (1.0 - (dist_2 * dist_2))\n  ) * 8.0) * tmpvar_8);\n  xlat_mutableuv3 = (((2.0 * uv2_3) * dist_2) + 0.6);\n  vec2 tmpvar_12;\n  tmpvar_12 = fract(xlat_mutableuv3);\n  xlat_mutableuv3 = tmpvar_12;\n  xlat_mutabledz.x = (xlat_mutabledz.x + (texture (sampler_main, (tmpvar_12 + tmpvar_5)).xyz - texture (sampler_main, (tmpvar_12 - tmpvar_5)).xyz).x);\n  xlat_mutabledz.y = (xlat_mutabledz.y + (texture (sampler_main, (tmpvar_12 + tmpvar_6)).xyz - texture (sampler_main, (tmpvar_12 - tmpvar_6)).xyz).x);\n  xlat_mutableneu = ((dist_2 * texture (sampler_main, tmpvar_12).xyz) + ((1.0 - dist_2) * dot (\n    ((texture (sampler_blur2, tmpvar_12).xyz * scale2) + bias2)\n  , vec3(0.32, 0.49, 0.29))));\n  xlat_mutableret1 = max (xlat_mutableret1, (xlat_mutableneu * inten_1));\n  ret_4 = ((xlat_mutableret1 * (1.0 - \n    dot (xlat_mutablemus, vec3(0.32, 0.49, 0.29))\n  )) + ((\n    (4.0 * xlat_mutablemus)\n   * \n    (1.0 + (3.0 * xlat_mutableret1))\n  ) * tmpvar_8));\n  ret_4 = (ret_4 * q32);\n  vec4 tmpvar_13;\n  tmpvar_13.w = 1.0;\n  tmpvar_13.xyz = ret_4;\n  ret = tmpvar_13.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.ready=0;a.index2=0;a.index4=0;a.index=0;a.q22=0;a.q21=0;a.q29=0;a.movex=0;a.fade=0;a.q1=0;a.dec_med=0;a.index3=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q4=0;a.is_beat2=0;a.q26=0;a.p2=0;a.avg=0;a.q19=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.q3=0;a.t0=0;a.q32=0;a.q28=0;a.q30=0;a.q20=0;a.shift=0;a.fade=.5;
return a;},frame_eqs:function(a){
a.dec_med=pow(.9,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.1+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,4);a.index2=mod(a.index2+a.is_beat*bnot(a.index),4);a.index3=mod(a.index3+a.is_beat*bnot(a.index)*bnot(a.index2),4);a.q20=a.avg;a.q21=
a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass+a.mid+a.treb;a.ready=a.is_beat*bnot(a.ready)+bnot(a.is_beat2)*a.ready;a.is_beat2=a.ready*above(a.time,a.t0+.2);a.q19=a.is_beat2;a.k1=a.is_beat*equal(a.index,0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.14159265359*a.p2,4);a.q27=a.index+1;a.q28=a.index2+1;a.q29=4*a.index3+1;a.q30=a.index4;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.movex+=div(.06,a.fps);a.q30=a.movex;a.fade=
a.dec_med*a.fade+(1-a.dec_med);a.q32=a.fade;a.zoom=.98;a.dx=.04*a.q2*bnot(a.index2);a.dy=.04*a.q1*bnot(a.index2);a.rot=.02;
return a;},pixel_eqs:''}),
"martin - disco mix 4":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.980001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":2,"modwavealphabyvolume":1,"wave_brighten":0,"wrap":0,"darken":1,"wave_a":0.001,"wave_scale":20.944651,"wave_smoothing":0,"wave_mystery":0.08,"modwavealphastart":0,"modwavealphaend":1.32,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0,"wave_g":0.99,"ob_size":0.015,"ob_b":1,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0,"b1ed":0},"warp":" shader_body { \n  vec2 uv_1;\n  vec2 uv6_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = ((uv - 0.5) * aspect.xy);\n  float tmpvar_4;\n  tmpvar_4 = ((2.0 * sqrt(\n    dot (tmpvar_3, tmpvar_3)\n  )) + (rand_frame * 64.0)).x;\n  uv_1 = (uv + (clamp (\n    ((sin(tmpvar_4) / cos(tmpvar_4)) * normalize(tmpvar_3))\n  , vec2(-2.0, -2.0), vec2(2.0, 2.0)) / 20.0));\n  uv6_2 = (0.4 * sin((tmpvar_3 * 22.0)));\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = (((q24 * \n    (((texture (sampler_main, uv_1).xyz - (\n      ((texture (sampler_blur1, fract(uv_1)).xyz * scale1) + bias1)\n     * 0.04)) + (0.15 * (vec3(\n      (0.1 / sqrt(dot (uv6_2, uv6_2)))\n    ) * roam_cos.xyz))) - 0.02)\n  ) * 0.98) + ((1.0 - q24) * texture (sampler_main, uv_orig).xyz));\n  ret = tmpvar_5.xyz;\n }","comp":"vec3 xlat_mutableret1;\nvec2 xlat_mutablers;\n shader_body { \n  vec2 uv1_1;\n  mat2 tmpvar_2;\n  tmpvar_2[uint(0)].x = q9;\n  tmpvar_2[uint(0)].y = -(q10);\n  tmpvar_2[1u].x = q10;\n  tmpvar_2[1u].y = q9;\n  uv1_1 = (((uv_orig - 0.5) * aspect.xy) * tmpvar_2);\n  uv1_1 = (uv1_1 * aspect.yx);\n  float tmpvar_3;\n  tmpvar_3 = (3.0 / abs(uv1_1.y));\n  xlat_mutablers.x = (uv1_1.x * tmpvar_3);\n  xlat_mutablers.y = (tmpvar_3 / 2.0);\n  mat2 tmpvar_4;\n  tmpvar_4[uint(0)].x = q5;\n  tmpvar_4[uint(0)].y = -(q6);\n  tmpvar_4[1u].x = q6;\n  tmpvar_4[1u].y = q5;\n  xlat_mutablers = (tmpvar_4 * xlat_mutablers);\n  vec2 tmpvar_5;\n  tmpvar_5.x = q7;\n  tmpvar_5.y = q8;\n  xlat_mutablers = (xlat_mutablers + tmpvar_5);\n  xlat_mutableret1 = ((texture (sampler_blur1, fract(\n    (xlat_mutablers / 12.0)\n  )).xyz * scale1) + bias1);\n  vec2 tmpvar_6;\n  tmpvar_6.y = 0.0;\n  tmpvar_6.x = q5;\n  vec4 tmpvar_7;\n  tmpvar_7.w = 1.0;\n  tmpvar_7.xyz = (((xlat_mutableret1 * 32.0) / tmpvar_3) + ((\n    ((q22 * sqrt(tmpvar_3)) / 4.0)\n   * \n    sin(((uv1_1 - q12) * q27))\n  .x) * texture (sampler_main, (\n    (((4.0 * xlat_mutableret1) / tmpvar_3).xy + ((uv1_1 / 2.0) / (0.5 + abs(uv1_1.y))))\n   + tmpvar_6)).xyz));\n  ret = tmpvar_7.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"textured":1,"y":0.47,"rad":0.24057,"tex_zoom":0.14057,"g":0.3,"b":0.5,"g2":0,"b2":0.3,"a2":1,"border_b":0,"border_a":0}},{init_eqs:function(a){
a.q24=0;
return a;},frame_eqs:function(a){
a.x=.5;a.y=.5;a.a=a.q24;a.a2=a.q24;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":100,"additive":1,"thickoutline":1,"rad":0.05134,"tex_zoom":0.12288,"r":0.3,"g":0.2,"b":0.2,"a":0.7,"g2":0,"border_r":0,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.r=.5+.3*Math.sin(a.time);a.g=.5+.3*Math.sin(div(a.time,1.5));a.b=.5+.3*Math.sin(div(a.time,3.7));a.r2=0;a.b2=0;a.g2=0;a.a=.05;a.a2=0;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"samples":100,"thick":1,"scaling":0.045052,"smoothing":0.1,"a":0.6}},{init_eqs:function(a){
a.k1=0;a.dy=0;a.dx=0;a.t2=0;a.q24=0;a.q27=0;
return a;},frame_eqs:function(a){
a.t2=.45+div(randint(10),100);
return a;},point_eqs:function(a){
a.k1=bnot(mod(100*a.sample+a.time,2));a.dy=.015*above(Math.sin(11*a.sample),0)+.008*above(Math.sin(a.time+74*a.sample),0)+.008*above(Math.sin(a.time+128*a.sample),0);a.dx=.01*above(Math.sin(27*a.sample),0)+.01*above(Math.sin(a.time+134*a.sample),0);a.x=.2*(a.sample-.5)+.5+a.dx;a.y=a.t2+a.dy;a.a=a.q24*a.k1*bnot(mod(a.q27,4));a.r=.6;a.g=0;a.b=.6;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.dec_xlow=0;a.index2=0;a.speed_=0;a.index=0;a.q12=0;a.q22=0;a.q21=0;a.q6=0;a.q1=0;a.dec_med=0;a.q5=0;a.q9=0;a.movx=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q10=0;a.tilt_=0;a.q4=0;a.peakx=0;a.dir__=0;a.dir=0;a.dir_=0;a.movy=0;a.q26=0;a.maxp=0;a.p2=0;a.avg=0;a.trig=0;a.beat=0;a.p1=0;a.peak=0;a.tilt=0;a.q2=0;a.q27=0;a.speed=0;a.q3=0;a.t0=0;a.q7=0;a.q20=0;a.q8=0;a.xk=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.8,div(30,a.fps));a.dec_slow=pow(.95,div(30,a.fps));a.dec_xlow=pow(.995,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.2+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,16);a.index2=mod(a.index2+a.is_beat*bnot(a.index),2);a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.q23=
a.index;a.q24=a.is_beat;a.q26=a.bass_att+a.mid_att+a.treb_att;a.q27=a.index+1;a.peakx=above(a.q22,1.5*a.maxp);a.maxp=Math.max(a.maxp,a.q22);a.maxp*=a.dec_xlow;a.k1=a.is_beat*equal(mod(a.index,3),0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.1416*a.p2,4);a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.trig=a.q24*bnot(mod(a.index,4));a.dir=a.dir+div(a.trig*a.q26*(div(randint(100),100)-.5),2)+a.peakx;a.dir_=a.dir_*a.dec_slow+a.dir*(1-a.dec_slow);
a.dir__=a.dir__*a.dec_slow+a.dir_*(1-a.dec_slow);a.q5=Math.cos(a.dir__);a.q6=Math.sin(a.dir__);a.speed=a.speed*bnot(a.trig)+div(a.trig*a.q26*5,a.fps);a.speed_=a.speed_*a.dec_slow+a.speed*(1-a.dec_slow);a.movx+=a.speed_*a.q6;a.movy+=a.speed_*a.q5;a.q7=a.movx;a.q8=a.movy;a.tilt=a.dir-a.dir__;a.tilt_=a.dec_slow*a.tilt_+(1-a.dec_slow)*a.tilt;a.monitor=a.maxp;a.q9=Math.cos(a.tilt_*a.speed_);a.q10=Math.sin(a.tilt_*a.speed_);a.q12=a.time;
return a;},pixel_eqs:function(a){
a.zoom=1.3;
return a;}}),
"Martin - disco mix 6":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.980001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":4,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken":1,"wave_a":0.001,"wave_scale":0.5274,"wave_smoothing":0.45,"modwavealphastart":0,"modwavealphaend":1.32,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0.8,"wave_g":0.49,"ob_size":0,"ob_b":1,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0,"b1ed":0},"pixel_eqs":"","warp":"float xlat_mutableq24;\n shader_body { \n  vec2 rs_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = (uv_orig - 0.5);\n  float theta_3;\n  theta_3 = (q1 * ((q27 * \n    sqrt(dot (tmpvar_2, tmpvar_2))\n  ) + (rand_frame * 64.0)).x);\n  rs_1 = (clamp ((\n    (sin(theta_3) / cos(theta_3))\n   * \n    normalize((1.0/(tmpvar_2)))\n  ), vec2(-4.0, -4.0), vec2(4.0, 4.0)) * cos((tmpvar_2.yx * q28)));\n  vec2 x_4;\n  x_4 = ((rs_1 * tmpvar_2) + 0.01);\n  xlat_mutableq24 = (q24 + 0.03);\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = ((xlat_mutableq24 * (\n    ((texture (sampler_main, (uv + (rs_1 / 44.0))).xyz + (vec3((0.002 / \n      sqrt(dot (x_4, x_4))\n    )) * roam_cos.xyz)) * 0.98)\n   - 0.02)) + ((\n    (1.0 - xlat_mutableq24)\n   * texture (sampler_main, \n    ((tmpvar_2 * q7) + 0.5)\n  ).xyz) * 0.99));\n  ret = tmpvar_5.xyz;\n }","comp":"vec3 xlat_mutableret1;\nvec2 xlat_mutablers;\nvec2 xlat_mutablers0;\nvec2 xlat_mutableuv2;\n shader_body { \n  vec2 uv_1;\n  uv_1.x = uv.x;\n  vec2 uv1_2;\n  uv_1.y = ((uv.y + q5) - 0.1);\n  vec2 tmpvar_3;\n  tmpvar_3 = ((uv_1 - 0.5) * aspect.xy);\n  float tmpvar_4;\n  tmpvar_4 = (1.0/((tmpvar_3.y + (tmpvar_3.x * q1))));\n  xlat_mutablers0.x = (tmpvar_3.x * tmpvar_4);\n  xlat_mutablers0.y = (tmpvar_4 / 4.0);\n  xlat_mutablers.x = xlat_mutablers0.x;\n  xlat_mutablers.y = (xlat_mutablers0.y + (time * 2.0));\n  vec2 tmpvar_5;\n  tmpvar_5.x = q5;\n  tmpvar_5.y = q6;\n  mat2 tmpvar_6;\n  tmpvar_6[uint(0)] = _qa.xy;\n  tmpvar_6[1u] = _qa.zw;\n  uv1_2 = ((tmpvar_3 + tmpvar_5) * tmpvar_6);\n  float tmpvar_7;\n  tmpvar_7 = clamp ((4.0 / tmpvar_4), 0.0, 1.0);\n  xlat_mutableuv2 = ((2.0 * uv1_2) * (sqrt(\n    dot (uv1_2, uv1_2)\n  ) + q8));\n  xlat_mutableuv2 = (xlat_mutableuv2 * aspect.yx);\n  vec2 tmpvar_8;\n  tmpvar_8 = fract(((xlat_mutableuv2 + 0.5) - (\n    (vec3(dot (texture (sampler_pw_noise_lq, (xlat_mutablers / 40.0)), vec4(0.32, 0.49, 0.29, 0.0))) - 0.5)\n   * tmpvar_7).xy));\n  xlat_mutableret1 = ((texture (sampler_main, tmpvar_8) * (1.0 - tmpvar_7)).xyz + (tmpvar_7 * (\n    (texture (sampler_blur1, tmpvar_8).xyz * scale1)\n   + bias1)));\n  xlat_mutableret1 = (xlat_mutableret1 * (1.0 + (\n    (q22 / 16.0)\n   * xlat_mutableret1)));\n  vec4 tmpvar_9;\n  tmpvar_9.w = 1.0;\n  tmpvar_9.xyz = (xlat_mutableret1 + (clamp (\n    ((texture (sampler_blur2, vec2(fract((\n      ((xlat_mutableuv2.y / xlat_mutableuv2.x) * q10)\n     / 3.0)))).xyz * scale2) + bias2)\n  , 0.0, 1.0) * clamp (\n    ((q22 / 24.0) - 0.4)\n  , 0.0, 1.0)));\n  ret = tmpvar_9.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index2=0;a.index=0;a.q22=0;a.q21=0;a.q29=0;a.q6=0;a.q1=0;a.dec_med=0;a.q5=0;a.trel=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q10=0;a.q4=0;a.ran=0;a.q26=0;a.p2=0;a.avg=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.q3=0;a.t0=0;a.rot1=0;a.q7=0;a.q28=0;a.q20=0;a.q8=0;a.indexa=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.9,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.beat=a.bass+a.mid+a.treb;a.beat*=a.beat;a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.3*a.avg+a.peak)*above(a.time,a.t0+.1);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,32);a.indexa=mod(a.indexa+a.is_beat,5);a.index2=mod(a.index2+a.is_beat*bnot(a.index),2);a.q20=
a.avg;a.q21=a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass_att+a.mid_att+a.treb_att+1;a.q27=a.index+1;a.q28=-a.index2+div(a.indexa,5);a.q29=a.index2;a.k1=a.is_beat*equal(mod(a.index,16),0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rot1=div(3.1416*a.p2,2);a.q8=Math.cos(a.rot1);a.rott+=div(1,a.fps)*Math.sin(div(a.time,3.5));a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.trel+=1*div(.5,a.fps);a.q5=div(Math.cos(div(a.time,6)+a.trel),
3);a.q6=div(Math.sin(a.trel),16)+.4;a.q7=1.02+.03*Math.sin(div(a.rott,3.7));a.ran=a.ran*(1-a.q24)+div(randint(100),100);a.q10=a.ran-.5;a.zoom=1;a.warp=0;
return a;},pixel_eqs:''}),
"martin - ghost city":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.980001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":6,"wave_thick":1,"modwavealphabyvolume":1,"darken":1,"wave_a":0.001,"wave_scale":0.159809,"wave_smoothing":0.45,"wave_mystery":0.08,"modwavealphastart":0,"modwavealphaend":1.32,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0,"wave_g":0,"wave_b":0,"wave_y":0.9,"ob_r":1,"ob_g":1,"ob_b":1,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0,"b1x":0.6999,"b1ed":0},"pixel_eqs":"","warp":"vec3 xlat_mutablenoise;\nvec2 xlat_mutablers;\nvec2 xlat_mutablers0;\nvec2 xlat_mutableuv1;\n shader_body { \n  vec3 copy_1;\n  vec2 tmpvar_2;\n  tmpvar_2.x = 0.5;\n  tmpvar_2.y = q5;\n  xlat_mutableuv1 = (uv - tmpvar_2);\n  float tmpvar_3;\n  tmpvar_3 = (1.0/(xlat_mutableuv1.y));\n  xlat_mutablers0.x = (xlat_mutableuv1.x * tmpvar_3);\n  xlat_mutablers0.y = tmpvar_3;\n  xlat_mutablers.x = xlat_mutablers0.x;\n  xlat_mutablers.y = (tmpvar_3 + (time * 0.3));\n  xlat_mutablenoise = (vec3(dot (texture (sampler_pw_noise_lq, (xlat_mutablers / 63.0)), vec4(0.32, 0.49, 0.29, 0.0))) * (dot (texture (sampler_pw_noise_lq, \n    (xlat_mutablers / 12.0)\n  ), vec4(0.32, 0.49, 0.29, 0.0)) + 0.5));\n  xlat_mutablenoise = (xlat_mutablenoise * (clamp (\n    ((10.0 * xlat_mutablenoise) - 8.0)\n  , 0.0, 1.0) * clamp (\n    (2.0 / tmpvar_3)\n  , 0.0, 1.0)));\n  vec2 tmpvar_4;\n  tmpvar_4.x = uv.x;\n  tmpvar_4.y = (uv.y - (0.024 / tmpvar_3));\n  vec2 tmpvar_5;\n  tmpvar_5.x = uv.x;\n  tmpvar_5.y = (uv.y - (0.012 / tmpvar_3));\n  copy_1 = (texture (sampler_main, tmpvar_4).xyz + texture (sampler_main, tmpvar_5).xyz);\n  vec2 tmpvar_6;\n  tmpvar_6.x = uv.x;\n  tmpvar_6.y = (uv.y - (0.006 / tmpvar_3));\n  copy_1 = (copy_1 + texture (sampler_main, tmpvar_6).xyz);\n  vec4 tmpvar_7;\n  tmpvar_7.w = 1.0;\n  tmpvar_7.xyz = ((xlat_mutablenoise + (\n    (((copy_1 / 3.0) * (1.0 + slow_roam_cos).xyz) / 2.0)\n   * 0.99)) - 0.005);\n  ret = tmpvar_7.xyz;\n }","comp":"vec3 xlat_mutablecont;\nvec3 xlat_mutableneu;\nvec3 xlat_mutableret1;\nvec2 xlat_mutablers2;\n shader_body { \n  vec2 uv_1;\n  float inten_2;\n  float dist_3;\n  uv_1 = (uv - 0.5);\n  uv_1 = (uv_1 * aspect.xy);\n  dist_3 = (1.0 - fract(q6));\n  inten_2 = ((dist_3 * (1.0 - dist_3)) * 6.0);\n  vec2 tmpvar_4;\n  tmpvar_4 = fract(((uv_1 * dist_3) + 0.55));\n  xlat_mutableneu = texture (sampler_main, tmpvar_4).xyz;\n  xlat_mutableret1 = max (vec3(0.0, 0.0, 0.0), (xlat_mutableneu * inten_2));\n  xlat_mutablecont = max (vec3(0.0, 0.0, 0.0), ((\n    -(texture (sampler_main, tmpvar_4).xyz)\n   + \n    ((texture (sampler_blur1, (tmpvar_4 + q7)).xyz * scale1) + bias1)\n  ) * inten_2));\n  dist_3 = (1.0 - fract((0.5 + q6)));\n  inten_2 = ((dist_3 * (1.0 - dist_3)) * 6.0);\n  vec2 tmpvar_5;\n  tmpvar_5 = fract(((uv_1 * dist_3) + 0.55));\n  xlat_mutableneu = texture (sampler_main, tmpvar_5).xyz;\n  xlat_mutableret1 = max (xlat_mutableret1, (xlat_mutableneu * inten_2));\n  xlat_mutablecont = max (xlat_mutablecont, ((\n    -(texture (sampler_main, tmpvar_5).xyz)\n   + \n    ((texture (sampler_blur1, (tmpvar_5 + q7)).xyz * scale1) + bias1)\n  ) * inten_2));\n  dist_3 = (1.0 - fract((1.0 + q6)));\n  inten_2 = ((dist_3 * (1.0 - dist_3)) * 6.0);\n  vec2 tmpvar_6;\n  tmpvar_6 = fract(((uv_1 * dist_3) + 0.55));\n  xlat_mutableneu = texture (sampler_main, tmpvar_6).xyz;\n  xlat_mutableret1 = max (xlat_mutableret1, (xlat_mutableneu * inten_2));\n  xlat_mutablecont = max (xlat_mutablecont, ((\n    -(texture (sampler_main, tmpvar_6).xyz)\n   + \n    ((texture (sampler_blur1, (tmpvar_6 + q7)).xyz * scale1) + bias1)\n  ) * inten_2));\n  vec2 tmpvar_7;\n  tmpvar_7.y = 5.0;\n  tmpvar_7.x = (time / 12.0);\n  xlat_mutablers2 = ((0.1 * cos(\n    ((uv_1 * 3.0) + tmpvar_7)\n  )) + (0.1 * xlat_mutableret1).xy);\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = (((-0.1 * xlat_mutableret1) + (\n    (clamp ((0.005 / sqrt(\n      dot (xlat_mutablers2, xlat_mutablers2)\n    )), 0.0, 1.0) * vec3(18.0, 16.2, 10.8))\n   * \n    (0.2 + (0.3 * xlat_mutableret1))\n  )) + ((\n    dot (xlat_mutablecont, vec3(0.32, 0.49, 0.29))\n   * \n    (1.0 + slow_roam_cos)\n  ) / 2.0).xyz);\n  ret = tmpvar_8.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index=0;a.q22=0;a.q21=0;a.q6=0;a.q1=0;a.dec_med=0;a.q5=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q4=0;a.q26=0;a.p2=0;a.avg=0;a.movez=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.q3=0;a.t0=0;a.q32=0;a.q7=0;a.q20=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.9,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.2+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,8);a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass+a.mid+a.treb;a.k1=a.is_beat*equal(a.index,0);a.p1=
a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_slow*a.p2+(1-a.dec_slow)*a.p1;a.rott=div(3.1416*a.p2,4);a.q27=a.index+1;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.zoom=1;a.rot=-0*a.index;a.q32=pow(.996,div(30,a.fps));a.q5=div(Math.sin(div(a.time,11))+1,5);a.movez+=div(.06,a.fps)*(1.1+a.q1);a.q6=a.movez;a.q7=.005*Math.sin(div(a.time,15));
return a;},pixel_eqs:''}),
"Martin - liquid arrows":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1.780001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":5,"wave_dots":1,"wave_thick":1,"wave_brighten":0,"darken":1,"wave_a":0.001,"wave_scale":5.552,"wave_smoothing":0.504,"wave_mystery":-1,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_g":0,"wave_b":0,"ob_size":0.06,"ob_r":1,"ob_g":1,"ob_b":1,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0,"b1x":0.6999,"b1ed":0},"pixel_eqs":"","warp":" shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1 = ((uv * texsize.xy) * 0.03);\n  vec2 tmpvar_2;\n  tmpvar_2.x = (cos((tmpvar_1.y * q1)) * sin(-(tmpvar_1.y)));\n  tmpvar_2.y = (sin(tmpvar_1.x) * cos((tmpvar_1.y * q2)));\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = ((texture (sampler_main, (uv - \n    ((tmpvar_2 * texsize.zw) * 18.0)\n  )).xyz * 0.99) - 0.01);\n  ret = tmpvar_3.xyz;\n }","comp":" shader_body { \n  vec2 uv1_1;\n  vec3 tmpvar_2;\n  tmpvar_2 = texture (sampler_main, uv).xyz;\n  vec2 tmpvar_3;\n  tmpvar_3.x = (texture (sampler_main, (uv - vec2(0.001, 0.0))).xyz - texture (sampler_main, (uv + vec2(0.001, 0.0))).xyz).x;\n  tmpvar_3.y = (texture (sampler_main, (uv - vec2(0.0, 0.001))).xyz - texture (sampler_main, (uv + vec2(0.0, 0.001))).xyz).x;\n  uv1_1 = ((0.3 * cos(\n    ((uv - 0.5) + 1.8)\n  )) - (2.0 * tmpvar_3));\n  vec4 tmpvar_4;\n  tmpvar_4.w = 1.0;\n  tmpvar_4.xyz = (0.8 * ((0.3 * \n    dot (tmpvar_2, vec3(0.32, 0.49, 0.29))\n  ) + (\n    (22.0 * clamp ((0.01 / sqrt(\n      dot (uv1_1, uv1_1)\n    )), 0.0, 1.0))\n   * \n    (tmpvar_2 + 0.1)\n  )));\n  ret = tmpvar_4.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":5,"additive":1,"x":0.9,"rad":0.22613,"g":0.6,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.05+div(randint(900),1E3);a.y=.05+div(randint(900),1E3);a.ang=div(randint(320),100);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.ready=0;a.index2=0;a.index4=0;a.index=0;a.q22=0;a.q21=0;a.sp0=0;a.q29=0;a.q1=0;a.dec_med=0;a.q5=0;a.index3=0;a.rott=0;a.is_beat=0;a.q31=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.go=0;a.q4=0;a.is_beat2=0;a.q26=0;a.p2=0;a.avg=0;a.movez=0;a.q19=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.q3=0;a.t0=0;a.q32=0;a.q28=0;a.q30=0;a.q20=0;a.index4=randint(2);a.index3=randint(4);
return a;},frame_eqs:function(a){
a.dec_med=pow(.9,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.5+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,4);a.index2=mod(a.index2+a.is_beat*bnot(a.index),4);a.index3=mod(a.index3+a.is_beat*bnot(a.index)*bnot(a.index2),4);a.index4=mod(a.index4+
a.is_beat*bnot(a.index)*bnot(a.index2)*bnot(a.index3),2);a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass+a.mid+a.treb;a.ready=a.is_beat*bnot(a.ready)+bnot(a.is_beat2)*a.ready;a.is_beat2=a.ready*above(a.time,a.t0+.2);a.q19=a.is_beat2;a.k1=a.is_beat*equal(a.index,0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.14159265359*a.p2,2);a.q27=a.index+1;a.q28=a.index2+1;a.q29=4*a.index3+1;a.q30=a.index4;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);
a.q3=-a.q2;a.q4=a.q1;a.sp0=a.dec_slow*a.sp0+(a.q24+.05)*(1-a.dec_slow);a.go=a.go*a.dec_med+(1-a.dec_med)*(1-bnot(a.index2+a.index3));a.movez+=div(.015*30,a.fps)*a.go;a.q31=a.movez;a.q32=.5+.02*Math.sin(div(a.time,5));a.q5=mod(a.index4,2);a.zoom=1;a.rot=0;a.dx=.05*Math.max(Math.sin(div(a.time,9.7))-.95,0);a.dy=.002*(1-a.go);a.rot=50*(a.dx-a.dy);
return a;},pixel_eqs:''}),
"Martin - QBikal - Surface Turbulence IIb":()=>Object.assign({"baseVals":{"rating":4,"gammaadj":1.98,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"wave_mode":4,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken":1,"wave_a":0.001,"wave_scale":0.527,"wave_smoothing":0.45,"modwavealphastart":0,"modwavealphaend":1.32,"warpanimspeed":1.459,"warpscale":2.007,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0.8,"wave_g":0.49,"ob_size":0.015,"ob_a":1,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0,"b2x":0.3,"b1ed":0},"warp":" shader_body { \n  vec4 tmpvar_1;\n  tmpvar_1.w = 1.0;\n  tmpvar_1.xyz = vec3(0.0, 0.0, 0.0);\n  ret = tmpvar_1.xyz;\n }","comp":"vec3 xlat_mutablecol;\n shader_body { \n  vec2 uv_1;\n  uv_1 = uv;\n  int iter_3;\n  vec3 ret_4;\n  ret_4 = texture (sampler_main, uv).xyz;\n  iter_3 = int((clamp (q29, 0.0, 1.0) * 8.0));\n  for (int n_2 = 1; n_2 < iter_3; n_2++) {\n    vec2 tmpvar_5;\n    tmpvar_5.y = 0.0;\n    tmpvar_5.x = float(n_2);\n    vec2 tmpvar_6;\n    tmpvar_6.y = 0.0;\n    tmpvar_6.x = float(n_2);\n    ret_4 = max (max (ret_4, texture (sampler_main, (uv_1 - \n      (texsize.zw * tmpvar_5)\n    )).xyz), texture (sampler_main, (uv_1 + (texsize.zw * tmpvar_6))).xyz);\n  };\n  float tmpvar_7;\n  tmpvar_7 = clamp ((1.0 - (2.0 * \n    dot (ret_4, vec3(0.32, 0.49, 0.29))\n  )), 0.0, 1.0);\n  float tmpvar_8;\n  float tmpvar_9;\n  tmpvar_9 = (uv.x - 0.5);\n  tmpvar_8 = (0.5 / ((\n    (uv.y + ((tmpvar_9 * 1.4) * (q5 * q3)))\n   - 0.4) + (0.3 * q4)));\n  vec2 tmpvar_10;\n  tmpvar_10.x = (tmpvar_8 * tmpvar_9);\n  tmpvar_10.y = tmpvar_8;\n  vec3 tmpvar_11;\n  tmpvar_11.x = q2;\n  tmpvar_11.y = q4;\n  tmpvar_11.z = q6;\n  xlat_mutablecol = (0.5 + (0.5 * tmpvar_11));\n  float x_12;\n  x_12 = ((uv.x - (\n    dot (ret_4, vec3(0.32, 0.49, 0.29))\n   * 5.0)) + 0.5);\n  ret_4 = (ret_4 * (q28 + (\n    ((6.0 * (0.05 / sqrt(\n      (x_12 * x_12)\n    ))) * (1.0 + xlat_mutablecol))\n   / 2.0)));\n  vec2 tmpvar_13;\n  tmpvar_13.x = q1;\n  tmpvar_13.y = (q3 + time);\n  float tmpvar_14;\n  tmpvar_14 = (((\n    (texture (sampler_noise_lq, (tmpvar_10 + tmpvar_13)).x * tmpvar_7)\n   * \n    float((tmpvar_8 > 0.0))\n  ) * 0.2) * min (1.0, (1.0/(tmpvar_8))));\n  ret_4 = (ret_4 + tmpvar_14);\n  ret_4 = (ret_4 + ((\n    (sin((12.0 * q2)) * tmpvar_7)\n   * tmpvar_14) * dot (\n    (12.0 * ((texture (sampler_blur1, (tmpvar_10 - vec2(-0.5, 0.3))).xyz * scale1) + bias1))\n  , vec3(0.32, 0.49, 0.29))));\n  ret_4 = (ret_4 + ((\n    ((0.5 / abs(tmpvar_8)) * normalize(xlat_mutablecol))\n   * \n    float((tmpvar_8 < 0.0))\n  ) * tmpvar_7));\n  vec4 tmpvar_15;\n  tmpvar_15.w = 1.0;\n  tmpvar_15.xyz = ret_4;\n  ret = tmpvar_15.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"samples":506,"sep":116,"spectrum":1,"thick":1,"scaling":1.07408,"smoothing":0,"a":0.7}},{init_eqs:function(a){
a.n=0;a.m=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.n=Math.floor((a.reg00+.5)*a.sample);a.m=30001+div(a.n,div(a.reg00,a.reg01));a.gmegabuf[Math.floor(a.m)]=a.value1+a.value2;a.x=a.gmegabuf[Math.floor(1E4+a.n)];a.y=a.gmegabuf[Math.floor(15E3+a.n)];a.a=a.gmegabuf[Math.floor(2E4+a.n)];a.b=Math.min(Math.max(a.gmegabuf[Math.floor(25E3+a.n)],0),1);a.r=1-a.b;a.g=.5;
return a;}}),Object.assign({"baseVals":{"enabled":1,"samples":506,"thick":1,"scaling":0.89152,"smoothing":0.82}},{init_eqs:function(a){
a.n=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.n=Math.floor((a.reg00+.5)*a.sample)+a.reg00;a.x=a.gmegabuf[Math.floor(1E4+a.n)];a.y=a.gmegabuf[Math.floor(15E3+a.n)];a.a=a.gmegabuf[Math.floor(2E4+a.n)];a.b=Math.min(Math.max(a.gmegabuf[Math.floor(25E3+a.n)],0),1);a.r=1-a.b;a.g=.5;
return a;}}),Object.assign({"baseVals":{"enabled":1,"samples":506,"thick":1,"scaling":0.89152,"smoothing":0.82}},{init_eqs:function(a){
a.n=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.n=Math.floor((a.reg00+.5)*a.sample)+2*a.reg00;a.x=a.gmegabuf[Math.floor(1E4+a.n)];a.y=a.gmegabuf[Math.floor(15E3+a.n)];a.a=a.gmegabuf[Math.floor(2E4+a.n)];a.b=Math.min(Math.max(a.gmegabuf[Math.floor(25E3+a.n)],0),1);a.r=1-a.b;a.g=.5;
return a;}}),Object.assign({"baseVals":{"enabled":1,"samples":506,"spectrum":1,"thick":1}},{init_eqs:function(a){
a.n=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.n=Math.floor((a.reg00-.5)*a.sample)+3*a.reg00;a.x=a.gmegabuf[Math.floor(1E4+a.n)];a.y=a.gmegabuf[Math.floor(15E3+a.n)];a.a=a.gmegabuf[Math.floor(2E4+a.n)];a.b=Math.min(Math.max(a.gmegabuf[Math.floor(25E3+a.n)],0),1);a.r=1-a.b;a.g=.5;
return a;}})],init_eqs:function(a){
a.xang=0;a.fov=0;a.hell=0;a.cbeat=0;a.index2=0;a.bindex=0;a.ran4=0;a.index=0;a.dec_v=0;a.yang=0;a.q29=0;a.q6=0;a.amp_=0;a.xlen=0;a.smooth=0;a.q1=0;a.dec_med=0;a.sum=0;a.q5=0;a.dec_f=0;a.trely=0;a.flen=0;a.reg01=0;a.my=0;a.oz=0;a.imag=0;a.is_beat=0;a.yind=0;a.oy0a=0;a.dec_slow=0;a.ran2=0;a.ind=0;a.z0=0;a.ylen=0;a.real=0;a.ran4_=0;a.ran3=0;a.q4=0;a.mz=0;a.oy0=0;a.amp=0;a.tc0=0;a.oy=0;a.avg=0;a.mx=0;a.vol=0;a.ran2_=0;a.peak=0;a.decc=0;a.q2=0;a.bd_bt=0;a.zang=0;a.q3=0;a.reg00=0;
a.trelz=0;a.q32=0;a.ran3_=0;a.q28=0;a.trelx=0;a.q30=0;a.ox=0;a.xind=0;for(var b=a.index=0;7E4>b;b++)a.megabuf[Math.floor(a.index)]=0,a.gmegabuf[Math.floor(a.index)]=0,a.index+=1;a.zang=1;a.yang=0;a.zang=2;
return a;},frame_eqs:function(a){
a.xlen=45;a.ylen=45;a.flen=30;a.reg00=div(a.xlen*a.ylen,4);a.reg01=div(a.reg00,4);a.dec_med=1-div(.06*30,a.fps);a.dec_slow=1-div(.6,a.fps);a.dec_f=pow(.8,div(30,a.fps));a.q30=a.dec_slow;a.smooth=Math.max(1,pow(6,div(a.fps,30))-2);a.cbeat=a.bass+a.mid+a.treb;a.decc=.00001<Math.abs(a.vol>a.cbeat?1:0)?.8:a.dec_med;a.vol=a.vol*a.decc+(1-a.decc)*a.cbeat;a.avg=a.avg*a.dec_slow+a.cbeat*(1-a.dec_slow);a.is_beat=above(a.cbeat,1.5*a.avg)*above(a.time,a.tc0+.2);a.tc0=.00001<Math.abs(bor(a.is_beat,
a.bd_bt))?a.time:a.tc0;a.peak=.00001<Math.abs(a.is_beat)?a.cbeat:a.peak*a.dec_med;a.ind=0;a.sum=0;a.amp=.01;for(var b=0;b<a.reg01;b++)a.sum+=div(a.gmegabuf[Math.floor(a.ind+3E4)],a.reg01),a.amp+=pow(a.gmegabuf[Math.floor(a.ind+3E4)],2),a.ind+=1;a.ind=0;a.amp_=a.amp_*a.dec_med+600*div((1-a.dec_med)*sqrt(a.amp),a.reg01);for(b=0;b<a.reg01;b++)a.megabuf[Math.floor(a.ind+3E4)]=div(a.gmegabuf[Math.floor(a.ind+3E4)]-a.sum,a.amp_),a.ind+=1;for(b=a.index2=0;b<a.flen;b++){a.index=0;a.real=0;for(var c=a.imag=
0;c<a.flen;c++)a.real+=Math.cos(6.28*div(a.index,a.flen)*a.index2)*a.megabuf[Math.floor(div(a.index*a.reg01,8)+30002)],a.imag+=Math.sin(6.28*div(a.index,a.flen)*a.index2)*a.megabuf[Math.floor(div(a.index*a.reg01,8)+30002)],a.index+=1;a.megabuf[Math.floor(1E4+a.index2)]=a.megabuf[Math.floor(1E4+a.index2)]*a.dec_f+a.real;a.megabuf[Math.floor(15E3+a.index2)]=a.megabuf[Math.floor(15E3+a.index2)]*a.dec_f+a.imag;a.index2+=1}a.ind=1;for(b=0;b<div(a.flen,2);b++){a.cx=a.megabuf[Math.floor(1E4+a.ind)];a.cy=
a.megabuf[Math.floor(15E3+a.ind)];a.yind=-1;for(c=0;3>c;c++){a.xind=-1;for(var d=0;3>d;d++)a.ox=mod((a.cx+.5)*a.xlen+a.xind,a.xlen),a.oy=mod((a.cy+.5)*a.ylen+a.yind,a.ylen),a.amp=3*(a.cx*a.cx+a.cy*a.cy),a.megabuf[Math.floor(a.oy*a.ylen+a.ox)]-=div(div(60,a.fps)*sqrt(a.amp)*above(a.amp,.02),1+a.xind*a.xind+a.yind*a.yind),a.xind+=1;a.yind+=1}a.ind+=1}for(b=a.yind=0;b<a.ylen;b++){for(c=a.xind=0;c<a.xlen;c++)a.megabuf[Math.floor(a.yind*a.ylen+a.xind+5E3)]=a.dec_med*(div(a.gmegabuf[Math.floor(a.yind*a.ylen+
mod(a.xind+1,a.xlen))]+a.gmegabuf[Math.floor(a.yind*a.ylen+mod(a.xlen+a.xind-1,a.xlen))]+a.gmegabuf[Math.floor(mod(a.yind+1,a.ylen)*a.ylen+a.xind)]+a.gmegabuf[Math.floor(mod(a.yind+a.ylen-1,a.ylen)*a.ylen+a.xind)]+a.gmegabuf[Math.floor(a.yind*a.ylen+a.xind)]*a.smooth*4,2+2*a.smooth)-a.megabuf[Math.floor(a.yind*a.ylen+a.xind)]),a.xind+=1;a.yind+=1}a.bindex+=a.is_beat;.00001<Math.abs(a.is_beat&&.00001>Math.abs(mod(a.bindex,4)-0)?1:0)?a.ran2=div(randint(100)-30,60):0;.00001<Math.abs(a.is_beat&&.00001>
Math.abs(mod(a.bindex,4)-2)?1:0)?a.ran3=div(randint(100)-30,60):0;.00001<Math.abs(a.is_beat&&.00001>Math.abs(mod(a.bindex,6)-2)?1:0)?a.ran4=div(randint(100)-30,60):0;a.dec_v=Math.min(Math.max(0,1-div(8*a.vol,a.fps)),a.dec_slow);a.ran2_=a.ran2_*a.dec_v+(1-a.dec_v)*a.ran2;a.ran3_=a.ran3_*a.dec_v+(1-a.dec_v)*a.ran3;a.ran4_=a.ran4_*a.dec_v+(1-a.dec_v)*a.ran4;a.trelx+=div(div(a.ran2_,a.fps),7);a.trely+=div(div(a.ran3_,a.fps),2);a.trelz+=div(div(a.ran4_,a.fps),6);a.zang=6*Math.sin(a.trelz);a.xang=6*Math.sin(div(a.zang,
5)+a.trelx);a.yang=6*Math.sin(0*div(a.zang,3)+a.trely);a.q1=Math.cos(a.xang);a.q2=Math.sin(a.xang);a.q3=Math.cos(a.yang);a.q4=Math.sin(a.yang);a.q5=Math.cos(a.zang);a.q6=Math.sin(a.zang);a.fov=1;for(b=a.yind=0;b<a.ylen;b++){for(c=a.xind=0;c<a.xlen;c++)a.ind=a.yind*a.ylen+a.xind,a.megabuf[Math.floor(a.ind)]=a.gmegabuf[Math.floor(a.ind)],a.gmegabuf[Math.floor(a.ind)]=a.megabuf[Math.floor(a.ind+5E3)],a.oz=a.yind-div(a.ylen,2),a.ox=.00001<Math.abs(bnot(mod(a.yind,2)))?a.xind:a.xlen-a.xind-1,a.oy0a=div(a.oy0+
a.oy0a,2.5),a.oy=a.gmegabuf[Math.floor(a.yind*a.ylen+a.ox)],a.oy0=a.oy,a.ox-=div(a.xlen,2),a.mx=a.ox*a.q5-a.oy*a.q6,a.my=a.ox*a.q6+a.oy*a.q5,a.ox=a.mx,a.oy=a.my,a.mx=a.ox*a.q3+a.oz*a.q4,a.mz=-a.ox*a.q4+a.oz*a.q3,a.ox=a.mx,a.oz=a.mz,a.my=a.oy*a.q1-a.oz*a.q2,a.mz=a.oy*a.q2+a.oz*a.q1,a.z0=90+40*Math.sin(14*a.trelz),a.oy=a.my,a.oz=a.mz+a.z0,a.gmegabuf[Math.floor(1E4+a.ind)]=div(a.fov*a.ox,a.oz)+.5,a.gmegabuf[Math.floor(15E3+a.ind)]=div(a.fov*a.oy,a.oz)+.5,a.hell=Math.max(Math.min(.5+div(a.oy0,4),1),.1),
a.gmegabuf[Math.floor(2E4+a.ind)]=Math.max(Math.min(a.hell*(.5+.1*(a.oy0a-a.oy0)),1),.1),a.gmegabuf[Math.floor(25E3+a.ind)]=div(a.oy0,16)+.5,a.xind+=1;a.yind+=1}a.q29=div(50*a.fov,a.z0);a.q32=a.aspecty;a.q28=Math.min(div(a.vol,3)-.3,1);a.monitor=a.is_beat;
return a;},pixel_eqs:function(a){
a.rot=0;a.zoom=1.1;a.warp=0;a.dy=.02;
return a;}}),
"martin - soma in pink":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1.980001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":4,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken":1,"wave_a":0.038558,"wave_scale":0.372353,"wave_smoothing":0,"wave_mystery":0.2,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0.8,"wave_g":0.3,"ob_r":1,"ob_g":1,"ob_b":1,"ib_size":0.26,"mv_x":64,"mv_y":48,"mv_l":1.85,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0,"b1ed":0},"warp":" shader_body { \n  vec2 tmpvar_1;\n  tmpvar_1 = (((uv - vec2(0.5, 0.5)) * texsize.xy) * 0.015);\n  vec4 tmpvar_2;\n  tmpvar_2.w = 1.0;\n  tmpvar_2.xyz = (((0.995 * texture (sampler_main, \n    (uv + (((\n      (clamp ((sin(tmpvar_1) / cos(tmpvar_1)), vec2(-12.0, -12.0), vec2(12.0, 12.0)) * cos(((4.0 * \n        (q2 + 1.0)\n      ) * tmpvar_1.yx)))\n     * texsize.zw) * 4.0) * (2.0 + q1)))\n  ).xyz) + vec3(0.01, 0.01, 0.01)) - 0.02);\n  ret = tmpvar_2.xyz;\n }","comp":" shader_body { \n  vec3 crisp_1;\n  vec2 uv3_2;\n  vec2 uv2_3;\n  vec2 tmpvar_4;\n  tmpvar_4 = ((uv - 0.5) * aspect.xy);\n  float tmpvar_5;\n  tmpvar_5 = (0.1 / (sqrt(\n    dot (tmpvar_4, tmpvar_4)\n  ) + 0.1));\n  vec2 tmpvar_6;\n  float tmpvar_7;\n  tmpvar_7 = (ang / 3.14);\n  tmpvar_6.x = tmpvar_7;\n  tmpvar_6.y = tmpvar_5;\n  uv2_3.y = (tmpvar_5 + (0.1 * time));\n  uv2_3.x = tmpvar_6.x;\n  vec2 tmpvar_8;\n  tmpvar_8.x = tmpvar_7;\n  tmpvar_8.y = (tmpvar_5 * 1.5);\n  uv3_2.y = (tmpvar_8.y + (0.08 * time));\n  uv3_2.x = (tmpvar_7 + (time / 32.0));\n  crisp_1 = (((2.0 * texture (sampler_main, uv2_3).xyz) + texture (sampler_main, uv3_2).xyz) + ((2.0 * \n    ((texture (sampler_blur2, fract(uv2_3)).xyz * scale2) + bias2)\n  ) + (2.0 * \n    ((texture (sampler_blur2, fract(uv3_2)).xyz * scale2) + bias2)\n  )));\n  crisp_1 = ((3.0 * crisp_1) * rad);\n  float tmpvar_9;\n  tmpvar_9 = clamp ((1.0 - (4.0 * rad)), 0.0, 1.0);\n  vec4 tmpvar_10;\n  tmpvar_10.w = 1.0;\n  tmpvar_10.xyz = ((crisp_1 + (\n    ((vec3(0.0, 0.0, 1.0) * uv.y) * pow ((1.0 - rad), 8.0))\n   * tmpvar_9)) + (tmpvar_9 * texture (sampler_main, uv).xyz));\n  ret = tmpvar_10.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":1,"usedots":1,"scaling":0.891519,"smoothing":0.82,"a":0.1}},{init_eqs:function(a){
a.xang=0;a.fov=0;a.t1=0;a.yang=0;a.my=0;a.oz=0;a.t_rel=0;a.mz=0;a.oy=0;a.mx=0;a.t2=0;a.zang=0;a.monitor=0;a.t_abs=0;a.ox=0;
return a;},frame_eqs:function(a){
a.t1=2*Math.sin(div(a.time,15));a.t2=2*Math.sin(div(a.time,11));a.monitor=a.time;
return a;},point_eqs:function(a){
a.t_abs=a.sample;a.ox=Math.sin(68*a.t_abs);a.oy=Math.cos(63*a.t_abs);a.oz=Math.sin(125*a.t_abs);a.r=1;a.g=.5;a.b=1;a.t_rel=a.sample-div(a.time,127);a.t_rel-=Math.floor(a.t_rel);a.a=mod(512*a.sample-2*a.time,2);a.a=1;a.xang=0;a.yang=a.t1;a.zang=a.t1;a.fov=.15;a.mx=a.ox*Math.cos(a.zang)-a.oy*Math.sin(a.zang);a.my=a.ox*Math.sin(a.zang)+a.oy*Math.cos(a.zang);a.ox=a.mx;a.oy=a.my;a.mx=a.ox*Math.cos(a.yang)+a.oz*Math.sin(a.yang);a.mz=-a.ox*Math.sin(a.yang)+a.oz*Math.cos(a.yang);a.ox=
a.mx;a.oz=a.mz;a.my=a.oy*Math.cos(a.xang)-a.oz*Math.sin(a.xang);a.mz=a.oy*Math.sin(a.xang)+a.oz*Math.cos(a.xang);a.oy=a.my;a.oz=a.mz;a.x=div(a.ox*a.fov,a.oz)+.5;a.y=div(a.oy*a.fov,a.oz)+.5;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index2=0;a.q25=0;a.index=0;a.q22=0;a.q21=0;a.q29=0;a.q1=0;a.dec_med=0;a.index3=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q4=0;a.q26=0;a.p2=0;a.avg=0;a.beat=0;a.p1=0;a.dx1=0;a.peak=0;a.q2=0;a.q27=0;a.p3=0;a.q3=0;a.t0=0;a.rot1=0;a.q28=0;a.q20=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.96,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.5+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,4);a.index2=mod(a.index2+a.is_beat*bnot(a.index),8);a.index3=mod(a.index3+a.is_beat*bnot(a.index)*bnot(a.index2),3);a.q20=a.avg;a.q21=
a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass+a.mid+a.treb;a.k1=a.is_beat*equal(a.index,0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.p3=a.dec_med*a.p3+(1-a.dec_med)*a.p2;a.rott=div(3.1416*a.p3,2);a.rot1+=a.q26;a.q25=.01*a.rot1;a.q27=8-a.index;a.q28=a.index3;a.dx1=a.dec_med*a.dx1+(1-a.dec_med)*bnot(a.index2);a.q29=a.dx1;a.monitor=a.q29;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;
return a;},pixel_eqs:function(a){
a.rot=0;a.dx=.02*a.q29;a.zoom=1;
return a;}}),
"martin - sunset over the river":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1,"decay":0,"echo_zoom":0,"echo_orient":3,"wave_mode":1,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken":1,"wave_a":0,"wave_scale":0,"wave_smoothing":0,"modwavealphastart":0,"modwavealphaend":1,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0,"wave_g":0,"wave_b":0,"wave_x":0,"wave_y":0,"ob_size":0,"ob_b":0.2,"ob_a":1,"ib_size":0,"ib_r":0,"ib_g":0,"ib_a":1,"mv_x":31,"mv_y":24,"mv_l":0,"mv_r":0,"mv_g":0,"mv_b":0,"mv_a":0,"b1ed":0},"pixel_eqs":"","warp":" shader_body { \n  float k1_1;\n  float ky_2;\n  vec2 uv3_3;\n  uv3_3 = (100.0 * (uv - vec2(0.5, 0.5)));\n  float tmpvar_4;\n  tmpvar_4 = dot (texture (sampler_noise_lq, uv), vec4(0.32, 0.49, 0.29, 0.0));\n  ky_2 = clamp (((\n    (-(uv3_3.y) / 100.0)\n   + \n    ((tmpvar_4 / 4.0) * cos((16.0 * tmpvar_4)))\n  ) + 0.23), 0.0, 1.0);\n  k1_1 = (uv3_3.x - (sign(uv3_3.x) * 24.0));\n  k1_1 = (k1_1 - (sign(k1_1) * 9.0));\n  k1_1 = (k1_1 + ((\n    (k1_1 - (12.0 * sign(k1_1)))\n   * ky_2) * ky_2));\n  ky_2 = clamp ((ky_2 - 0.1), 0.0, 1.0);\n  k1_1 = (k1_1 + ((\n    (k1_1 - (24.0 * sign(k1_1)))\n   * ky_2) * ky_2));\n  ky_2 = clamp ((ky_2 - 0.1), 0.0, 1.0);\n  k1_1 = (k1_1 + ((\n    (k1_1 - (36.0 * sign(k1_1)))\n   * ky_2) * ky_2));\n  ky_2 = clamp ((ky_2 - 0.1), 0.0, 1.0);\n  k1_1 = (k1_1 + ((\n    (k1_1 - (48.0 * sign(k1_1)))\n   * ky_2) * ky_2));\n  ky_2 = clamp ((ky_2 - 0.1), 0.0, 1.0);\n  k1_1 = (k1_1 + ((\n    (k1_1 - (60.0 * sign(k1_1)))\n   * ky_2) * ky_2));\n  ky_2 = clamp ((ky_2 - 0.1), 0.0, 1.0);\n  float tmpvar_5;\n  tmpvar_5 = clamp (k1_1, -1.6, 1.6);\n  k1_1 = tmpvar_5;\n  vec4 tmpvar_6;\n  tmpvar_6.w = 1.0;\n  tmpvar_6.xyz = ((texture (sampler_main, fract(uv)).xyz * 0.5) + (vec3(0.1, 0.0, 0.0) * cos(tmpvar_5)));\n  ret = tmpvar_6.xyz;\n }","comp":"float xlat_mutablehoriz;\nvec3 xlat_mutableret1;\nvec2 xlat_mutablers;\nvec2 xlat_mutableuv2;\nvec2 xlat_mutableuv5;\nvec3 xlat_mutablewater;\n shader_body { \n  vec2 uv_1;\n  vec3 clouds_2;\n  vec3 ret_3;\n  uv_1 = (uv - 0.5);\n  uv_1 = (uv_1 * aspect.xy);\n  uv_1.x = uv_1.x;\n  float tmpvar_4;\n  tmpvar_4 = clamp ((1.0/((uv_1.y - 0.1))), 0.0, 200.0);\n  vec2 tmpvar_5;\n  tmpvar_5.x = ((uv_1.x * tmpvar_4) + time);\n  tmpvar_5.y = tmpvar_4;\n  xlat_mutablers = (tmpvar_5 / 44.0);\n  xlat_mutablewater = (vec3((dot (texture (sampler_noise_lq, xlat_mutablers), vec4(0.32, 0.49, 0.29, 0.0)) - 0.5)) * clamp ((16.0 * \n    (uv_1.y - 0.1)\n  ), 0.0, 1.0));\n  float tmpvar_6;\n  tmpvar_6 = (xlat_mutablewater / 16.0).x;\n  vec2 tmpvar_7;\n  tmpvar_7.x = (uv_1.x + q31);\n  tmpvar_7.y = (abs((uv_1.y - 0.1)) - abs((q31 / 2.0)));\n  float tmpvar_8;\n  tmpvar_8 = clamp ((1.0/(abs(\n    (uv_1.y - 0.1)\n  ))), 0.0, 200.0);\n  vec2 tmpvar_9;\n  tmpvar_9.x = (tmpvar_7.x * tmpvar_8);\n  tmpvar_9.y = tmpvar_8;\n  xlat_mutablers = ((tmpvar_9 / 16.0) + tmpvar_6);\n  clouds_2 = (vec3(dot (texture (sampler_noise_hq, xlat_mutablers), vec4(0.32, 0.49, 0.29, 0.0))) * ((\n    clamp ((0.6 - (2.0 * (uv_1.y - 0.1))), 0.0, 1.0)\n   * 0.5) / (0.04 + \n    sqrt(dot (tmpvar_7, tmpvar_7))\n  )));\n  vec3 tmpvar_10;\n  tmpvar_10.xy = vec2(1.0, 0.6);\n  tmpvar_10.z = (q32 / tmpvar_8);\n  clouds_2 = (clouds_2 * tmpvar_10);\n  vec2 tmpvar_11;\n  tmpvar_11.y = 0.0;\n  tmpvar_11.x = (q28 / 4.0);\n  xlat_mutableuv5 = ((uv_1 + tmpvar_11) + tmpvar_6);\n  vec2 tmpvar_12;\n  tmpvar_12.x = (xlat_mutableuv5.x * 8.0);\n  tmpvar_12.y = (xlat_mutableuv5.y * 4.0);\n  xlat_mutablehoriz = ((abs(\n    (xlat_mutableuv5.y - 0.1)\n  ) * (1.0 + texture (sampler_noise_lq, tmpvar_12).x)) * (1.0 + texture (sampler_noise_hq, vec2((xlat_mutableuv5.x / 4.0))).x));\n  float tmpvar_13;\n  tmpvar_13 = clamp ((1.0 - (q30 * xlat_mutablehoriz)), 0.0, 1.0);\n  xlat_mutablehoriz = tmpvar_13;\n  xlat_mutableuv2.y = uv_1.y;\n  xlat_mutableuv2.x = (uv_1.x + 0.65);\n  xlat_mutableuv2 = (((1.12 * xlat_mutableuv2) - 0.1) - 0.4);\n  vec2 tmpvar_14;\n  tmpvar_14 = (q28 * vec2(1.0, 0.0));\n  xlat_mutableret1 = texture (sampler_main, fract((xlat_mutableuv2 + tmpvar_14))).xyz;\n  xlat_mutableuv2.y = uv_1.y;\n  xlat_mutableuv2.x = (uv_1.x + 1.3);\n  xlat_mutableuv2 = (((0.92 * xlat_mutableuv2) - 0.1) - 0.4);\n  xlat_mutableret1 = (xlat_mutableret1 + texture (sampler_main, fract((xlat_mutableuv2 + tmpvar_14))).xyz);\n  xlat_mutableuv2.y = uv_1.y;\n  xlat_mutableuv2.x = (uv_1.x + 1.95);\n  xlat_mutableuv2 = (((0.72 * xlat_mutableuv2) - 0.1) - 0.4);\n  xlat_mutableret1 = (xlat_mutableret1 + texture (sampler_main, fract((xlat_mutableuv2 + tmpvar_14))).xyz);\n  ret_3 = (((\n    ((0.1 * (0.5 + xlat_mutablewater)) + (0.2 / q30))\n   * vec3(0.0, 0.5, 0.6)) + clamp (\n    (clouds_2 * (1.0 - (4.0 * tmpvar_13)))\n  , 0.0, 1.0)) + (vec3(tmpvar_13) * 0.06));\n  ret_3 = (ret_3 * clamp ((1.0 - \n    (xlat_mutableret1.x * 8.0)\n  ), 0.0, 1.0));\n  vec4 tmpvar_15;\n  tmpvar_15.w = 1.0;\n  tmpvar_15.xyz = ret_3;\n  ret = tmpvar_15.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"textured":1,"x":0,"y":0.13,"rad":0.591236,"ang":0.628319,"tex_ang":0.628319,"tex_zoom":0.591233,"r2":1,"g2":0,"border_r":0,"border_g":0,"border_b":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"samples":187,"sep":9,"usedots":1,"additive":1,"scaling":0,"smoothing":0,"r":0,"b":0}},{init_eqs:function(a){
a.t1=0;a.t2=0;a.k1=0;a.k2=0;a.t3=0;
return a;},frame_eqs:function(a){
a.t1=1;a.t3=Math.sin(div(a.time,2));a.t3=Math.max(a.t3,0);a.t3=4.9*Math.min(a.t3,.2);
return a;},point_eqs:function(a){
a.t1=mod(67*a.t1+37,4096);a.t2=div(a.t1,4096);a.k1=mod(100*a.sample+2*a.time,2);a.k2=mod(100*a.sample+5*a.time,2);a.x=.49+.48*Math.sin(31*a.sample+div(a.t2*a.time,27));a.y=.2*a.t2+.2*Math.sin(131*a.sample+div(a.t2*a.time,7));a.a=1;a.r=.07;
return a;}}),Object.assign({"baseVals":{"enabled":1,"scaling":0,"smoothing":0,"a":0}},{init_eqs:function(a){
a.t1=0;a.px=0;a.t2=0;a.py=0;a.k1=0;
return a;},frame_eqs:function(a){
a.t1=1;a.t2=7;
return a;},point_eqs:function(a){
a.r=.31;a.b=0;a.g=0;a.a=1;a.t1=mod(67*a.t1+37,4096);a.px=div(a.t1-2047,4096);a.t2=mod(67*a.t2+37,4096);a.py=div(a.t2-0,4096);a.k1=mod(100*a.sample,8);a.y=div(a.py,3.5)+0;a.a=below(a.y,.2);a.x=.5+.4*Math.sin(26*a.sample);
return a;}}),Object.assign({"baseVals":{"enabled":1,"samples":100,"scaling":0,"smoothing":0,"a":0}},{init_eqs:function(a){
a.t5=0;a.t1=0;a.bird=0;a.y0=0;a.dx=0;a.t3=0;a.ground=0;a.k1=0;a.t6=0;a.f1=0;a.trig=0;a.dy=0;a.t2=0;a.t4=0;
return a;},frame_eqs:function(a){
a.t1=Math.sin(3*a.time);a.t2=Math.cos(3*a.time);a.t3=Math.sin(div(a.time,3));a.t4=Math.cos(div(a.time,3));a.t5=div(Math.cos(div(a.time,4)),2);a.ground=below(a.t5,-.9);a.trig=below(randint(100),1);a.trig=a.trig*bnot(a.ground)*bnot(a.bird);a.bird*=bnot(a.ground);a.bird=bnot(a.bird)*a.trig;a.t6=a.bird;
return a;},point_eqs:function(a){
a.r=1;a.g=0;a.b=0;a.k1=below(a.sample,.5);a.dx=.01*a.k1*Math.sin(50*a.sample);a.f1=sqr(a.dx);a.dy=40*a.f1*a.t1+div(a.t2,150);a.dy+=.002*(1-a.k1)*Math.sin(50*a.sample);a.x=a.dx+.5+.1*a.t3;a.dy+=.2*a.dx*a.t4;a.y0=a.t5;a.y=a.dy+.5+div(a.y0,8);a.a=.04;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index2=0;a.index=0;a.q22=0;a.q21=0;a.q15=0;a.q29=0;a.q1=0;a.dec_med=0;a.q5=0;a.movx=0;a.rott=0;a.is_beat=0;a.q31=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.sb=0;a.q4=0;a.q26=0;a.p2=0;a.avg=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.p3=0;a.q3=0;a.t0=0;a.q32=0;a.q28=0;a.q30=0;a.q20=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.8,div(30,a.fps));a.dec_slow=pow(.9,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.5+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,16);a.index2=mod(a.index2+a.is_beat*bnot(a.index),5);a.monitor=a.index2;a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;
a.q26=a.bass+a.mid+a.treb;a.sb=a.sb*a.dec_med+a.q21*(1-a.dec_med);a.q29=a.sb;a.k1=a.is_beat*bnot(a.index)*bnot(a.index2);a.p1=a.index2-2;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.p3=a.dec_med*a.p3+(1-a.dec_med)*a.p2;a.q5=Math.cos(div(3.14*a.p3,2));a.rott+=div(.09,a.fps)*a.p3;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;a.movx+=div(.06,a.fps);a.q28=a.movx;a.q15=.15*(1+Math.sin(div(a.time,23)));a.q29=4*(.5+Math.sin(div(a.time,17)));a.q30=div(5,1.2+Math.sin(div(a.time,50)));a.q31=
div(Math.sin(div(a.time,38)),3);a.q32=2+Math.sin(div(a.time,18));a.warp=.06;a.zoom=.998;
return a;},pixel_eqs:''}),
"martin - violet flash":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.980001,"decay":0.5,"echo_zoom":0.999998,"echo_alpha":0.5,"echo_orient":3,"wave_mode":1,"additivewave":1,"wave_dots":1,"darken":1,"wave_a":0.005428,"wave_scale":3.782626,"wave_smoothing":0.81,"wave_mystery":-1,"modwavealphastart":0.47,"modwavealphaend":1.32,"warpanimspeed":1.4595,"warpscale":2.0067,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0.45,"wave_g":0.4,"wave_b":0.5,"ob_size":0.06,"ob_r":1,"ob_g":1,"ob_b":1,"ib_size":0.26,"mv_x":64,"mv_y":47.999996,"mv_l":0.15,"mv_r":0.6,"mv_g":0.2,"mv_b":0.6999,"mv_a":0.3,"b1ed":0},"pixel_eqs":"","warp":" shader_body { \n  vec2 zz_1;\n  vec2 uv1_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = ((uv - vec2(0.5, 0.5)) * aspect.xy);\n  mat2 tmpvar_4;\n  tmpvar_4[uint(0)] = _qa.xy;\n  tmpvar_4[1u] = _qa.zw;\n  zz_1 = (((tmpvar_3 * texsize.xy) * (0.006 * q28)) * tmpvar_4);\n  zz_1 = ((zz_1.yx * q5) + ((1.0 - q5) * zz_1));\n  uv1_2 = (0.3 * cos((\n    (tmpvar_3 * 16.0)\n   + \n    (time / 8.0)\n  )));\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = ((0.995 * (texture (sampler_main, \n    (uv + (((\n      clamp ((sin(zz_1.yx) / cos(zz_1.yx)), vec2(-8.0, -8.0), vec2(8.0, 8.0))\n     * \n      cos(((rand_preset * 8.0).xy * zz_1))\n    ) * texsize.zw) * q29))\n  ).xyz + \n    (((0.004 / sqrt(\n      dot (uv1_2, uv1_2)\n    )) * q19) * vec3(0.5, 0.0, 1.0))\n  )) - 0.005);\n  ret = tmpvar_5.xyz;\n }","comp":"vec3 xlat_mutableret1;\n shader_body { \n  vec2 uv_1;\n  float inten_2;\n  float dist_3;\n  vec2 uv2_4;\n  uv_1 = (uv - 0.5);\n  uv_1 = (uv_1 * aspect.xy);\n  uv2_4.x = ((uv_1.x * 0.5) - (uv_1.y * -0.5));\n  uv2_4.y = ((uv_1.x * -0.5) + (uv_1.y * 0.5));\n  uv2_4 = (uv2_4 * aspect.yx);\n  dist_3 = (1.0 - fract((0.25 + q31)));\n  inten_2 = ((2.0 * sqrt(dist_3)) * (1.0 - (dist_3 * dist_3)));\n  xlat_mutableret1 = max (vec3(0.0, 0.0, 0.0), (texture (sampler_main, (\n    ((2.0 * uv2_4) * dist_3)\n   + q32)).xyz * inten_2));\n  uv2_4.x = ((uv_1.x * -0.5) - (uv_1.y * 0.5));\n  uv2_4.y = ((uv_1.x * 0.5) + (uv_1.y * -0.5));\n  uv2_4 = (uv2_4 * aspect.yx);\n  dist_3 = (1.0 - fract((0.5 + q31)));\n  inten_2 = ((2.0 * sqrt(dist_3)) * (1.0 - (dist_3 * dist_3)));\n  xlat_mutableret1 = max (xlat_mutableret1, (texture (sampler_main, (\n    ((2.0 * uv2_4) * dist_3)\n   + q32)).xyz * inten_2));\n  uv2_4.x = ((uv_1.x * 0.5) - (uv_1.y * -0.5));\n  uv2_4.y = ((uv_1.x * -0.5) + (uv_1.y * 0.5));\n  uv2_4 = (uv2_4 * aspect.yx);\n  dist_3 = (1.0 - fract((0.75 + q31)));\n  inten_2 = ((2.0 * sqrt(dist_3)) * (1.0 - (dist_3 * dist_3)));\n  xlat_mutableret1 = max (xlat_mutableret1, (texture (sampler_main, (\n    ((2.0 * uv2_4) * dist_3)\n   + q32)).xyz * inten_2));\n  uv2_4.x = ((uv_1.x * -0.5) - (uv_1.y * 0.5));\n  uv2_4.y = ((uv_1.x * 0.5) + (uv_1.y * -0.5));\n  uv2_4 = (uv2_4 * aspect.yx);\n  dist_3 = (1.0 - fract((1.0 + q31)));\n  inten_2 = ((2.0 * sqrt(dist_3)) * (1.0 - (dist_3 * dist_3)));\n  xlat_mutableret1 = max (xlat_mutableret1, (texture (sampler_main, (\n    ((2.0 * uv2_4) * dist_3)\n   + q32)).xyz * inten_2));\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = (xlat_mutableret1 * 1.6);\n  ret = tmpvar_5.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"textured":1,"x":0.53,"rad":0.0882,"tex_zoom":0.4928,"g":1,"b":0.7,"a":0.7,"r2":0.4,"g2":0,"b2":0.8,"a2":0.6,"border_b":0.2,"border_a":0.2}},{init_eqs:function(a){
a.trig=0;a.q28=0;a.q24=0;a.seed=0;a.rr1=0;
return a;},frame_eqs:function(a){
a.trig=equal(mod(a.q28,2),1)*a.q24;a.seed=sqr(a.time-Math.floor(a.time));a.rr1=a.rr1*(1-a.trig)+a.seed*a.trig;a.textured=bnot(a.q24);a.ang=div(3.1416,4)*a.q28;a.x=.5+.01*a.rr1*mod(a.q28,3);a.y=a.x+.002;a.border_a=.4;a.a=.8;a.a2=.5;a.rad=.14*a.rr1;a.tex_zoom=div(.7,a.rad);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"x":0.553,"y":0.6,"rad":0.049138,"tex_zoom":0.499805,"g":1,"b":1,"r2":1,"g2":0,"b2":1,"border_r":0.5,"border_g":0.5,"border_b":0.5,"border_a":0}},{init_eqs:function(a){
a.q24=0;
return a;},frame_eqs:function(a){
a.textured=bnot(a.q24);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"samples":102,"sep":10,"scaling":0.891519,"smoothing":0,"g":0.5,"b":0.5,"a":0.6}},{init_eqs:function(a){
a.dx=0;a.iy=0;a.k1=0;a.ix=0;a.k2=0;a.q26=0;a.oy=0;a.dy=0;a.sp=0;a.k0=0;a.ox=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.k0=Math.floor(100*a.sample);a.k2=Math.floor(100*a.sample+1);a.k1=equal(mod(a.k0,2),0);a.k2=equal(mod(a.k0,2),1);a.ix=mod(100*a.value1,7)-3;a.iy=mod(100*a.value2,7)-3;a.sp=a.bass_att+a.treb_att;a.sp=div(a.sp,1E3);a.dx=.99*(a.dx+a.sp*a.ix);a.dy=.99*(a.dy+a.sp*a.iy);a.ox=a.k1*a.dx+(1-a.k1)*a.ox;a.oy=a.k2*a.dy+(1-a.k2)*a.oy;a.x=a.ox+.5;a.y=a.oy+.5;a.r=.6;a.g=.8;a.b=.9;a.a=.1+div(a.q26,8);a.a=div(Math.max(a.a,1),4);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.ready=0;a.index2=0;a.index4=0;a.index=0;a.q22=0;a.q21=0;a.sp0=0;a.q29=0;a.q1=0;a.dec_med=0;a.q5=0;a.index3=0;a.rott=0;a.is_beat=0;a.q31=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.go=0;a.q4=0;a.is_beat2=0;a.q26=0;a.p2=0;a.avg=0;a.movez=0;a.q19=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.q3=0;a.t0=0;a.q32=0;a.q28=0;a.q30=0;a.q20=0;a.index4=randint(2);a.index3=randint(4);
return a;},frame_eqs:function(a){
a.dec_med=pow(.9,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.5+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,4);a.index2=mod(a.index2+a.is_beat*bnot(a.index),4);a.index3=mod(a.index3+a.is_beat*bnot(a.index)*bnot(a.index2),4);a.index4=mod(a.index4+
a.is_beat*bnot(a.index)*bnot(a.index2)*bnot(a.index3),2);a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.q23=a.index;a.q24=a.is_beat;a.q26=a.bass+a.mid+a.treb;a.ready=a.is_beat*bnot(a.ready)+bnot(a.is_beat2)*a.ready;a.is_beat2=a.ready*above(a.time,a.t0+.2);a.q19=a.is_beat2;a.k1=a.is_beat*equal(a.index,0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.14159265359*a.p2,2);a.q27=a.index+1;a.q28=a.index2;a.q29=4*a.index3+1;a.q30=a.index4;a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);
a.q3=-a.q2;a.q4=a.q1;a.sp0=a.dec_slow*a.sp0+(a.q24+.05)*(1-a.dec_slow);a.go=a.go*a.dec_med+(1-a.dec_med)*(1-bnot(a.index2+a.index3));a.movez+=div(.015*30,a.fps)*a.go;a.q31=a.movez;a.q32=.5+.02*Math.sin(div(a.time,5));a.q5=mod(a.index4,2);a.zoom=1;a.rot=0;a.cx=.5+.1*Math.sin(div(a.time,2));a.dx=.05*Math.max(Math.sin(div(a.time,9.7))-.95,0);a.dy=.002*(1-a.go);a.rot=50*(a.dx-a.dy);a.monitor=a.q5;
return a;},pixel_eqs:''}),
"martin [shadow harlequins shape code] - fata morgana":()=>Object.assign({"baseVals":{"rating":4,"gammaadj":1.98,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"darken":1,"wave_a":0.001,"wave_scale":0.133,"wave_smoothing":0,"wave_mystery":-1,"modwavealphastart":1,"modwavealphaend":1.3,"warpanimspeed":1.459,"warpscale":2.007,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0.5,"wave_g":0.5,"wave_b":0.5,"ob_size":0.015,"ob_b":1,"ib_size":0.26,"mv_a":0,"b2x":0.3,"b1ed":0},"warp":" shader_body { \n  vec2 uv_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = (uv - vec2(0.5, 0.5));\n  vec4 tmpvar_3;\n  tmpvar_3.w = 0.0;\n  vec4 tmpvar_4;\n  tmpvar_4 = texture (sampler_blur1, uv);\n  tmpvar_3.xyz = ((tmpvar_4.xyz * scale1) + bias1);\n  float tmpvar_5;\n  tmpvar_5 = (dot (tmpvar_3, roam_sin) * 16.0);\n  mat2 tmpvar_6;\n  tmpvar_6[uint(0)].x = cos(tmpvar_5);\n  tmpvar_6[uint(0)].y = -(sin(tmpvar_5));\n  tmpvar_6[1u].x = sin(tmpvar_5);\n  tmpvar_6[1u].y = cos(tmpvar_5);\n  uv_1 = ((tmpvar_2 + (\n    (0.2 * dot (((tmpvar_4.xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29)))\n   * \n    (tmpvar_2 * tmpvar_6)\n  )) - 0.5);\n  vec2 tmpvar_7;\n  tmpvar_7 = ((uv_1 * texsize.xy) * 0.02);\n  vec2 tmpvar_8;\n  tmpvar_8.x = (cos((tmpvar_7.y * q1)) * sin(-(tmpvar_7.y)));\n  tmpvar_8.y = (sin(tmpvar_7.x) * cos((tmpvar_7.y * q2)));\n  uv_1 = (uv_1 - ((tmpvar_8 * texsize.zw) * 12.0));\n  vec4 tmpvar_9;\n  tmpvar_9.w = 1.0;\n  tmpvar_9.xyz = ((texture (sampler_main, uv_1).xyz * 0.98) - 0.02);\n  ret = tmpvar_9.xyz;\n }","comp":"vec3 xlat_mutableret1;\nvec2 xlat_mutablers;\nvec2 xlat_mutableuv1;\nfloat xlat_mutablez;\n shader_body { \n  xlat_mutableuv1 = (uv - 0.5);\n  xlat_mutablez = (0.2 / abs(xlat_mutableuv1.y));\n  xlat_mutablers.x = (xlat_mutableuv1.x * xlat_mutablez);\n  xlat_mutablers.y = ((xlat_mutablez / 2.0) + (time * 4.0));\n  vec4 tmpvar_1;\n  tmpvar_1 = texture (sampler_noise_hq, xlat_mutablers);\n  xlat_mutableret1 = ((tmpvar_1.xyz * vec3(\n    greaterThanEqual (tmpvar_1.xyz, vec3(0.0, 0.0, 0.0))\n  )) - 0.6);\n  float tmpvar_2;\n  tmpvar_2 = clamp ((128.0 * xlat_mutableuv1.y), 0.0, 1.0);\n  vec2 tmpvar_3;\n  tmpvar_3 = fract(((\n    (xlat_mutableuv1 * (1.0 - abs(xlat_mutableuv1.x)))\n   - 0.5) - (\n    (xlat_mutableret1 * 0.05)\n   * tmpvar_2).xy));\n  float x_4;\n  x_4 = (tmpvar_3.y - 0.52);\n  vec3 tmpvar_5;\n  tmpvar_5 = (texture (sampler_main, tmpvar_3) + ((0.02 / \n    (0.02 + sqrt((x_4 * x_4)))\n  ) * slow_roam_sin)).xyz;\n  xlat_mutableret1 = tmpvar_5;\n  vec2 tmpvar_6;\n  tmpvar_6 = (32.0 * ((\n    (uv * mat2(0.6, -0.8, 0.8, 0.6))\n   + \n    (tmpvar_5 * 0.1)\n  .xy) + (time / 64.0)));\n  vec2 tmpvar_7;\n  tmpvar_7 = abs((fract(tmpvar_6) - 0.5));\n  vec3 tmpvar_8;\n  tmpvar_8 = clamp (((0.25 / \n    sqrt(dot (tmpvar_7, tmpvar_7))\n  ) * vec3((texture (sampler_pw_noise_lq, \n    (tmpvar_6 / 256.0)\n  ).y - 0.9))), 0.0, 1.0);\n  vec4 tmpvar_9;\n  tmpvar_9.w = 1.0;\n  tmpvar_9.xyz = (tmpvar_5 + ((\n    (tmpvar_8.x * tmpvar_8.x)\n   + \n    ((rand_preset * (0.5 - uv.y)).xyz * vec3(0.0, 0.0, 1.0))\n  ) * (1.0 - tmpvar_2)));\n  ret = tmpvar_9.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":40,"thickoutline":1,"rad":0.06623,"tex_zoom":1.79845,"r":0,"a":0.1,"g2":0,"border_b":0,"border_a":0}},{init_eqs:function(a){
a.vol=0;a.bob=0;a.border_1=0;a.ro=0;a.sp=0;a.red=0;a.spi=0;a.tm=0;a.bob=1.5;a.ro=0;a.red=randint(20);
return a;},frame_eqs:function(a){
a.vol=1+.2*div(a.bass_att+a.treb_att+a.mid_att,3);a.bob=a.bob*above(a.bob,.01)-.01+(1-above(a.bob,.01));a.bob=.4+.4*Math.sin(.8*a.time);a.bob*=a.vol;a.border_1=.4;a.sides=30;a.ro+=.02;a.ang=a.ro;a.sp=.025*a.red;a.spi=.5-a.sp;a.tm=.1*a.time;a.border_r=.5+a.sp*Math.sin(.6*a.tm)+a.spi*Math.cos(1.46*a.tm);a.border_g=.5+a.sp*Math.sin(1.294*a.tm)+a.spi*Math.cos(.87*a.tm);a.border_b=.5+a.sp*Math.sin(1.418*a.tm)+a.spi*Math.cos(.76*a.tm);
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":40,"additive":1,"num_inst":4,"g":1,"b":1,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.5+.225*Math.sin(.7*div(a.time,a.instance));a.y=.5+.3*Math.cos(.7*div(a.time,a.instance));a.x-=.4*a.x*Math.sin(a.time);a.y-=.4*a.y*Math.cos(a.time);a.rad*=a.mid_att;a.r=.5+.5*Math.sin(.5*a.frame);a.b=.5+.5*Math.sin(.5*a.frame+2.094);a.g=.5+.5*Math.sin(.5*a.frame+4.188);
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":40,"additive":1,"g":1,"b":1,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.5+.5*(.3*Math.sin(1.1*a.time)+.7*Math.sin(.5*a.time));a.x=.5+.225*Math.sin(a.time+2.09);a.y=.5+.3*Math.cos(a.time+2.09);a.rad*=a.bass_att;a.r=.5+.5*Math.sin(.5*a.frame);a.b=.5+.5*Math.sin(.5*a.frame+2.094);a.g=.5+.5*Math.sin(.5*a.frame+4.188);
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":40,"additive":1,"num_inst":5,"rad":0.07419,"g":1,"b":1,"g2":0,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x=.5+.225*Math.sin(div(a.time,a.instance));a.y=.5+.3*Math.cos(div(a.time,a.instance));a.x+=.4*a.x*Math.sin(a.time);a.y+=.4*a.y*Math.cos(a.time);a.rad*=a.treb_att;a.r=.5+.5*Math.sin(.5*a.frame);a.b=.5+.5*Math.sin(.5*a.frame+2.094);a.g=.5+.5*Math.sin(.5*a.frame+4.188);
return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.index2=0;a.index=0;a.q22=0;a.q21=0;a.q1=0;a.dec_med=0;a.ps=0;a.rott=0;a.is_beat=0;a.q23=0;a.k1=0;a.q24=0;a.dec_slow=0;a.q4=0;a.q26=0;a.p2=0;a.avg=0;a.beat=0;a.p1=0;a.peak=0;a.q2=0;a.q27=0;a.q3=0;a.t0=0;a.q28=0;a.q20=0;
return a;},frame_eqs:function(a){
a.dec_med=pow(.7,div(30,a.fps));a.dec_slow=pow(.99,div(30,a.fps));a.beat=Math.max(Math.max(a.bass,a.mid),a.treb);a.avg=a.avg*a.dec_slow+a.beat*(1-a.dec_slow);a.is_beat=above(a.beat,.2+a.avg+a.peak)*above(a.time,a.t0+.2);a.t0=a.is_beat*a.time+(1-a.is_beat)*a.t0;a.peak=a.is_beat*a.beat+(1-a.is_beat)*a.peak*a.dec_med;a.index=mod(a.index+a.is_beat,8);a.index2=mod(a.index2+a.is_beat*bnot(a.index),2);a.q20=a.avg;a.q21=a.beat;a.q22=a.peak;a.ps=.9*a.ps+.1*a.q22;a.q23=a.ps;a.q24=a.is_beat;
a.q26=a.bass_att+a.mid_att+a.treb_att;a.q27=a.index+1;a.q28=a.index2;a.k1=a.is_beat*equal(mod(a.index,2),0);a.p1=a.k1*(a.p1+1)+(1-a.k1)*a.p1;a.p2=a.dec_med*a.p2+(1-a.dec_med)*a.p1;a.rott=div(3.1416*a.p2,4);a.q1=Math.cos(a.rott);a.q2=Math.sin(a.rott);a.q3=-a.q2;a.q4=a.q1;
return a;},pixel_eqs:function(a){
a.zoom=1.05;
return a;}}),
"martin, flexi, fishbrain + sto - enterstate [random mashup]":()=>Object.assign({"baseVals":{"rating":2,"gammaadj":1.98,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"wave_mode":3,"wave_thick":1,"wrap":0,"darken":1,"wave_a":100,"wave_scale":0.282,"wave_smoothing":0.9,"wave_mystery":1,"warpanimspeed":1.459,"warpscale":2.007,"zoom":0.9999,"warp":0.01,"sx":0.9999,"wave_r":0.5,"wave_g":0.5,"wave_b":0.5,"ob_size":0.05,"ob_g":0.1,"ob_b":1,"ob_a":1,"ib_size":0,"ib_r":0,"ib_g":0,"ib_b":0,"mv_a":0,"b1ed":0},"warp":" shader_body { \n  float dy_1;\n  float dx_2;\n  vec3 ret_3;\n  vec2 tmpvar_4;\n  tmpvar_4 = ((uv * texsize.xy) * texsize_noise_lq.zw);\n  vec2 tmpvar_5;\n  tmpvar_5 = (texsize.zw * 4.0);\n  vec2 tmpvar_6;\n  tmpvar_6.x = (((2.0 * \n    ((texture (sampler_blur1, (uv + (vec2(1.0, 0.0) * tmpvar_5))).xyz * scale1) + bias1)\n  ) - (2.0 * \n    ((texture (sampler_blur1, (uv - (vec2(1.0, 0.0) * tmpvar_5))).xyz * scale1) + bias1)\n  )).y * 0.5);\n  tmpvar_6.y = (((2.0 * \n    ((texture (sampler_blur1, (uv + (vec2(0.0, 1.0) * tmpvar_5))).xyz * scale1) + bias1)\n  ) - (2.0 * \n    ((texture (sampler_blur1, (uv - (vec2(0.0, 1.0) * tmpvar_5))).xyz * scale1) + bias1)\n  )).y * 0.5);\n  ret_3.y = texture (sampler_fw_main, clamp ((uv + (\n    (tmpvar_6 * texsize.zw)\n   * 4.0)), 0.0, 1.0)).y;\n  ret_3.y = (ret_3.y + ((\n    (ret_3 - ((texture (sampler_blur1, uv).xyz * scale1) + bias1))\n  .y * 0.025) + -0.01));\n  ret_3.y = (ret_3.y + ((texture (sampler_noise_lq, tmpvar_4).y - 0.5) * 0.02));\n  dx_2 = (((2.0 * \n    ((texture (sampler_blur1, (uv + (vec2(1.0, 0.0) * tmpvar_5))).xyz * scale1) + bias1)\n  ) - (2.0 * \n    ((texture (sampler_blur1, (uv - (vec2(1.0, 0.0) * tmpvar_5))).xyz * scale1) + bias1)\n  )).z * 0.5);\n  dy_1 = (((2.0 * \n    ((texture (sampler_blur1, (uv + (vec2(0.0, 1.0) * tmpvar_5))).xyz * scale1) + bias1)\n  ) - (2.0 * \n    ((texture (sampler_blur1, (uv - (vec2(0.0, 1.0) * tmpvar_5))).xyz * scale1) + bias1)\n  )).z * 0.5);\n  vec2 tmpvar_7;\n  tmpvar_7.x = dx_2;\n  tmpvar_7.y = dy_1;\n  ret_3.z = ((texture (sampler_main, (uv - \n    ((tmpvar_7 * texsize.zw) * 4.0)\n  )).z - (ret_3.y * 0.01)) + 0.004);\n  ret_3.z = (ret_3.z + ((texture (sampler_noise_lq, tmpvar_4).y - 0.5) * 0.01));\n  dx_2 = (((2.0 * \n    ((texture (sampler_blur1, (uv + (tmpvar_5 * vec2(1.0, 0.0)))).xyz * scale1) + bias1)\n  ) - (2.0 * \n    ((texture (sampler_blur1, (uv + (tmpvar_5 * vec2(-1.0, 0.0)))).xyz * scale1) + bias1)\n  )).x * 0.5);\n  dy_1 = (((2.0 * \n    ((texture (sampler_blur1, (uv + (tmpvar_5 * vec2(0.0, 1.0)))).xyz * scale1) + bias1)\n  ) - (2.0 * \n    ((texture (sampler_blur1, (uv + (tmpvar_5 * vec2(0.0, -1.0)))).xyz * scale1) + bias1)\n  )).x * 0.5);\n  vec2 tmpvar_8;\n  tmpvar_8.x = dx_2;\n  tmpvar_8.y = dy_1;\n  vec2 tmpvar_9;\n  tmpvar_9 = (tmpvar_8 * texsize.zw);\n  vec2 domain_10;\n  domain_10 = (uv - (tmpvar_9 * 2.5));\n  vec4 tmpvar_11;\n  tmpvar_11.w = 0.0;\n  tmpvar_11.xyz = max (vec4(0.0, 0.0, 0.0, 0.0), texture (sampler_fc_main, (domain_10 + (texsize.zw * vec2(-1.0, 0.0))))).xyz;\n  vec4 tmpvar_12;\n  tmpvar_12.w = 0.0;\n  tmpvar_12.xyz = max (tmpvar_11, texture (sampler_fc_main, (domain_10 + (texsize.zw * vec2(0.0, -1.0))))).xyz;\n  vec4 tmpvar_13;\n  tmpvar_13.w = 0.0;\n  tmpvar_13.xyz = max (tmpvar_12, texture (sampler_fc_main, domain_10)).xyz;\n  vec4 tmpvar_14;\n  tmpvar_14.w = 0.0;\n  tmpvar_14.xyz = max (tmpvar_13, texture (sampler_fc_main, (domain_10 + (texsize.zw * vec2(0.0, 1.0))))).xyz;\n  ret_3.x = ((max (tmpvar_14, texture (sampler_fc_main, \n    (domain_10 + (texsize.zw * vec2(1.0, 0.0)))\n  )).x + (\n    (texture (sampler_main, (uv + (tmpvar_9 * 4.0))).x - ((texture (sampler_blur1, (uv + \n      (tmpvar_9 * 4.0)\n    )).xyz * scale1) + bias1).x)\n   * 0.206)) - 0.09);\n  vec4 tmpvar_15;\n  tmpvar_15.w = 1.0;\n  tmpvar_15.xyz = ret_3;\n  ret = tmpvar_15.xyz;\n }","comp":"float xlat_mutablelamp;\nvec2 xlat_mutablers0;\nvec2 xlat_mutablerss;\nvec2 xlat_mutableuv1;\n shader_body { \n  vec3 tmpvar_1;\n  tmpvar_1.x = q4;\n  tmpvar_1.y = q5;\n  tmpvar_1.z = q6;\n  mat3 tmpvar_2;\n  tmpvar_2[uint(0)].x = q20;\n  tmpvar_2[uint(0)].y = q23;\n  tmpvar_2[uint(0)].z = q26;\n  tmpvar_2[1u].x = q21;\n  tmpvar_2[1u].y = q24;\n  tmpvar_2[1u].z = q27;\n  tmpvar_2[2u].x = q22;\n  tmpvar_2[2u].y = q25;\n  tmpvar_2[2u].z = q28;\n  vec2 tmpvar_3;\n  tmpvar_3.x = q1;\n  tmpvar_3.y = q2;\n  vec2 uv_4;\n  vec3 dots_5;\n  vec3 ret_6;\n  vec2 tmpvar_7;\n  vec2 tmpvar_8;\n  tmpvar_8 = (uv - 0.5);\n  tmpvar_7 = (0.5 + (tmpvar_8 * vec2(1.1, 0.81)));\n  vec2 tmpvar_9;\n  tmpvar_9 = (uv - vec2(0.5, 0.5));\n  uv_4 = (tmpvar_8 * aspect.xy);\n  float tmpvar_10;\n  float tmpvar_11;\n  tmpvar_11 = (min (abs(\n    (uv_4.y / uv_4.x)\n  ), 1.0) / max (abs(\n    (uv_4.y / uv_4.x)\n  ), 1.0));\n  float tmpvar_12;\n  tmpvar_12 = (tmpvar_11 * tmpvar_11);\n  tmpvar_12 = (((\n    ((((\n      ((((-0.01213232 * tmpvar_12) + 0.05368138) * tmpvar_12) - 0.1173503)\n     * tmpvar_12) + 0.1938925) * tmpvar_12) - 0.3326756)\n   * tmpvar_12) + 0.9999793) * tmpvar_11);\n  tmpvar_12 = (tmpvar_12 + (float(\n    (abs((uv_4.y / uv_4.x)) > 1.0)\n  ) * (\n    (tmpvar_12 * -2.0)\n   + 1.570796)));\n  tmpvar_10 = (tmpvar_12 * sign((uv_4.y / uv_4.x)));\n  if ((abs(uv_4.x) > (1e-08 * abs(uv_4.y)))) {\n    if ((uv_4.x < 0.0)) {\n      if ((uv_4.y >= 0.0)) {\n        tmpvar_10 += 3.141593;\n      } else {\n        tmpvar_10 = (tmpvar_10 - 3.141593);\n      };\n    };\n  } else {\n    tmpvar_10 = (sign(uv_4.y) * 1.570796);\n  };\n  xlat_mutablers0.x = ((tmpvar_10 / 3.1416) * 2.0);\n  xlat_mutablers0.y = (0.02 / sqrt(dot (uv_4, uv_4)));\n  vec2 tmpvar_13;\n  tmpvar_13.x = xlat_mutablers0.x;\n  tmpvar_13.y = (xlat_mutablers0.y + time);\n  xlat_mutablerss = (tmpvar_13 * mat2(0.7, -0.7, 0.7, 0.7));\n  vec4 tmpvar_14;\n  tmpvar_14 = vec4(greaterThanEqual ((texture (sampler_pw_noise_lq, \n    (xlat_mutablerss / 32.0)\n  ) - 0.7), vec4(0.0, 0.0, 0.0, 0.0)));\n  vec2 tmpvar_15;\n  tmpvar_15 = abs((fract(\n    (xlat_mutablerss * 8.0)\n  ) - 0.5));\n  vec2 tmpvar_16;\n  tmpvar_16.x = (xlat_mutablers0.x * 2.0);\n  tmpvar_16.y = (xlat_mutablers0.y + (time / 2.0));\n  xlat_mutablerss = (tmpvar_16 * mat2(0.7, -0.7, 0.7, 0.7));\n  vec4 tmpvar_17;\n  tmpvar_17 = vec4(greaterThanEqual ((texture (sampler_pw_noise_lq, \n    (xlat_mutablerss / 32.0)\n  ) - 0.7), vec4(0.0, 0.0, 0.0, 0.0)));\n  vec2 tmpvar_18;\n  tmpvar_18 = abs((fract(\n    (xlat_mutablerss * 8.0)\n  ) - 0.5));\n  xlat_mutablerss = tmpvar_18;\n  dots_5 = (vec3((clamp (\n    (0.04 / sqrt(dot (tmpvar_15, tmpvar_15)))\n  , 0.0, 1.0) * tmpvar_14.x)) + (clamp (\n    (0.04 / sqrt(dot (tmpvar_18, tmpvar_18)))\n  , 0.0, 1.0) * tmpvar_17.x));\n  dots_5 = (dots_5 * clamp ((0.04 / \n    abs((0.01 / xlat_mutablers0.y))\n  ), 0.0, 1.0));\n  dots_5 = (dots_5 * (dots_5 * 2.0));\n  vec2 tmpvar_19;\n  tmpvar_19.x = -((tmpvar_9.y * -1024.0));\n  tmpvar_19.y = (tmpvar_9.x * -1024.0);\n  vec2 tmpvar_20;\n  tmpvar_20.x = tmpvar_19.x;\n  tmpvar_20.y = -(tmpvar_19.y);\n  uv_4 = (vec2(-100.0, 100.0) * (tmpvar_20 / (\n    (tmpvar_19.x * tmpvar_19.x)\n   + \n    (tmpvar_19.y * tmpvar_19.y)\n  )).yx);\n  uv_4 = (0.5 + ((\n    (1.0 - abs(((\n      fract((mix ((0.5 + \n        ((tmpvar_7 - 0.5) * 2.0)\n      ), (uv_4 + 0.5), vec2(0.5, 0.5)) * 0.5))\n     * 2.0) - 1.0)))\n   - 0.5) * 0.98));\n  uv_4 = (((uv_4 - 0.5) * 0.9) + 0.5);\n  xlat_mutableuv1 = ((uv_4 - tmpvar_3) * aspect.xy);\n  float tmpvar_21;\n  tmpvar_21 = min ((1.0 - texture (sampler_main, uv_4).z), (1.0 - (\n    (texture (sampler_blur2, uv_4).xyz * scale2)\n   + bias2).z));\n  vec3 tmpvar_22;\n  tmpvar_22.xy = ((uv_4 - 0.5) * min ((1.0 - texture (sampler_main, uv_4).z), (1.0 - \n    ((texture (sampler_blur2, uv_4).xyz * scale2) + bias2)\n  .z)));\n  tmpvar_22.z = min ((1.0 - texture (sampler_main, uv_4).z), (1.0 - (\n    (texture (sampler_blur2, uv_4).xyz * scale2)\n   + bias2).z));\n  float tmpvar_23;\n  tmpvar_23 = clamp ((abs(\n    ((1.0 - ((texture (sampler_blur2, uv_4).xyz * scale2) + bias2).z) - clamp ((1.0 - (\n      (texture (sampler_blur2, tmpvar_3).xyz * scale2)\n     + bias2).z), 0.1, 0.4))\n  ) + 0.2), 0.0, 1.0);\n  vec3 tmpvar_24;\n  tmpvar_24 = mix (texture (sampler_main, uv_4).xyz, ((texture (sampler_blur1, uv_4).xyz * scale1) + bias1), vec3(tmpvar_23));\n  float tmpvar_25;\n  tmpvar_25 = clamp (((1.0 - \n    exp(-(((texture (sampler_blur1, uv_4).xyz * scale1) + bias1).x))\n  ) - 0.2), 0.0, 1.0);\n  ret_6 = ((tmpvar_24.x * (0.2 + \n    ((1.0 - tmpvar_23) * (1.0 - tmpvar_21))\n  )) * (1.0 + (0.5 * \n    sin((((tmpvar_22 / q7) * tmpvar_2) + tmpvar_1))\n  )));\n  vec3 tmpvar_26;\n  tmpvar_26.xy = vec2(0.0, 1.0);\n  tmpvar_26.z = (tmpvar_25 * 3.0);\n  vec3 tmpvar_27;\n  tmpvar_27 = mix (ret_6, tmpvar_26, vec3(tmpvar_25));\n  xlat_mutablelamp = (((\n    clamp ((1.0 - (4.0 * sqrt(\n      dot (xlat_mutableuv1, xlat_mutableuv1)\n    ))), 0.0, 1.0)\n   * tmpvar_24.x) * clamp (\n    (1.0 - (2.0 * mix (tmpvar_21, (1.0 - \n      ((texture (sampler_blur1, uv_4).xyz * scale1) + bias1)\n    .z), 0.2)))\n  , 0.0, 1.0)) * 1.8);\n  ret_6 = (tmpvar_27 + ((1.0 - \n    dot (tmpvar_27, vec3(0.32, 0.49, 0.29))\n  ) * xlat_mutablelamp));\n  ret_6 = (1.0 - exp((-2.0 * ret_6)));\n  ret_6 = (ret_6 + (dots_5 * (1.0 + ret_6)));\n  vec4 tmpvar_28;\n  tmpvar_28.w = 1.0;\n  tmpvar_28.xyz = ret_6;\n  ret = tmpvar_28.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"spectrum":1,"thick":1,"scaling":0.2248}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){
a.r=a.bass;a.g=a.treb;a.b=.5;
return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.bass,1)*.01*a.bass;a.ma-=3.1415*above(a.treb,1)*.01*a.treb;a.mx+=.0002*Math.cos(a.ma);a.my+=.0002*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.8);
return a;}}),Object.assign({"baseVals":{"enabled":1,"spectrum":1,"thick":1,"scaling":0.2743}},{init_eqs:function(a){
a.ma=0;a.mx=0;a.my=0;
return a;},frame_eqs:function(a){
a.r=a.bass;a.g=a.treb;a.b=.5;
return a;},point_eqs:function(a){
a.ma+=3.1415*above(a.mid,1)*.01*a.mid;a.ma-=3.1415*above(a.treb,1)*.01*a.treb;a.mx+=.0004*Math.cos(a.ma);a.my+=.0004*Math.sin(a.ma);a.mx=.00001<Math.abs(above(a.mx,.9))?.9-a.mx:a.mx;a.my=.00001<Math.abs(above(a.my,.9))?.9-a.my:a.my;a.mx=.00001<Math.abs(below(a.mx,.1))?.9+a.mx:a.mx;a.my=.00001<Math.abs(below(a.my,.1))?.9+a.my:a.my;a.x=a.mx;a.y=a.my;a.a=above(a.bass+a.mid+a.treb,.3);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"scaling":2.0231,"smoothing":0}},{init_eqs:function(a){
a.d=0;a.tt2=0;a.res=0;a.tt1=0;a.diff=0;a.tt3=0;a.beat=0;a.vol=0;a.m=0;a.monitor=0;a.t2=0;a.t3=0;a.t4=0;a.cl=0;
return a;},frame_eqs:function(a){
a.vol=8*a.bass+5*a.mid+3*a.treb;a.m=.97*a.m+.08*a.vol;a.monitor=a.vol;a.beat=above(a.vol,a.res)*above(a.vol,a.m)*above(a.vol,16);a.diff=(1-a.beat)*a.diff+a.beat*(a.vol-a.res);a.res=a.beat*(a.vol+.04*a.m)+(1-a.beat)*(a.res-div(60*(.1+.02*a.diff),a.fps));a.res=Math.max(0,a.res);
return a;},point_eqs:function(a){
a.tt3=.6*a.tt3+1*a.value1;a.tt2=.7*a.tt2+.2*a.tt3;a.tt1=.8*a.tt1+.1*a.tt2;a.d=.9*a.d+.2*a.tt1;a.y=.5+a.d*a.sample*(1-a.sample)*2;a.x=-.05+1.1*a.sample;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.look=0;a.n=0;a.reg26=0;a.uvx0=0;a.reg34=0;a.reg28=0;a.reg23=0;a.q25=0;a.angchg=0;a.reg20=0;a.reg15=0;a.reg10=0;a.q12=0;a.v3=0;a.q22=0;a.q21=0;a.diry=0;a.q13=0;a.q6=0;a.posx=0;a.fps_=0;a.reg25=0;a.uvx=0;a.q1=0;a.travel=0;a.posz=0;a.q5=0;a.dirz=0;a.dec_s=0;a.reg16=0;a.slow=0;a.reg36=0;a.reg22=0;a.uvy=0;a.rotz=0;a.ly=0;a.dist_=0;a.q23=0;a.q24=0;a.reg24=0;a.cran0=0;a.ran2=0;a.q11=0;a.q10=0;a.reg14=0;a.posy=0;a.reg31=0;a.dirx=0;a.q4=0;a.start=0;a.reg12=0;a.reg13=0;a.c2=0;a.reg37=
0;a.s3=0;a.yslope=0;a.lampy=0;a.q16=0;a.xslope=0;a.q26=0;a.reg38=0;a.reg35=0;a.reg11=0;a.tx=0;a.avg=0;a.uvz=0;a.c3=0;a.uvy0=0;a.reg27=0;a.q19=0;a.beat=0;a.reg32=0;a.lx=0;a.reg21=0;a.uvz0=0;a.len=0;a.reg18=0;a.reg30=0;a.q2=0;a.q27=0;a.slen=0;a.q14=0;a.dist=0;a.reg17=0;a.v1=0;a.speed=0;a.s1=0;a.t0=0;a.s2=0;a.ran1=0;a.reg33=0;a.q7=0;a.ds=0;a.q28=0;a.lampx=0;a.ty=0;a.c1=0;a.v2=0;a.q20=0;a.q8=0;a.avg=.01;a.q7=.25;a.q8=randint(2)-1;a.q16=1+randint(2);a.q18=randint(.8)+.1;a.q30=1;a.q31=128;a.start=1;a.travel=
0;a.rotz=0;a.look=0;a.slow=0;a.t0=a.time+3;a.lampx=.5;a.lampy=.5;a.cran0=randint(1);for(var b=a.n=0;1E4>b;b++)a.gmegabuf[Math.floor(a.n)]=0,a.n+=1;for(b=a.n=0;1E4>b;b++)a.megabuf[Math.floor(a.n)]=0,a.n+=1;a.trelx=0;a.trely=0;a.trelz=0;a.reg20=1;a.reg21=0;a.reg22=0;a.reg23=0;a.reg24=1;a.reg25=0;a.reg26=0;a.reg27=0;a.reg28=1;b=0;do{b+=1;var c;a.ran1=div(randint(800),100);a.ran2=div(randint(800),100);a.ran3=div(randint(800),100);a.posx=randint(5)-2;a.posy=randint(5)-2;a.posz=randint(5)-2;a.c1=Math.cos(a.ran1);
a.c2=Math.cos(a.ran2);a.c3=Math.cos(a.ran3);a.s1=Math.sin(a.ran1);a.s2=Math.sin(a.ran2);a.s3=Math.sin(a.ran3);a.reg20=a.c2*a.c1;a.reg21=a.c2*a.s1;a.reg22=-a.s2;a.reg23=a.s3*a.s2*a.c1-a.c3*a.s1;a.reg24=a.s3*a.s2*a.s1+a.c3*a.c1;a.reg25=a.s3*a.c2;a.reg26=a.c3*a.s2*a.c1+a.s3*a.s1;a.reg27=a.c3*a.s2*a.s1-a.s3*a.c1;a.reg28=a.c3*a.c2;a.dist=.001;var d=0;do{d+=1;a.uvx=div(a.reg26*a.dist,a.q7);a.uvy=div(a.reg27*a.dist,a.q7);a.uvz=div(a.reg28*a.dist,a.q7);a.uvx+=a.posx;a.uvy+=a.posy;a.uvz+=a.posz;a.uvx=8*(div(a.uvx,
8)+30.5-Math.floor(div(a.uvx,8)+30.5)-.5);a.uvy=8*(div(a.uvy,8)+30.5-Math.floor(div(a.uvy,8)+30.5)-.5);a.uvz=8*(div(a.uvz,8)+30.5-Math.floor(div(a.uvz,8)+30.5)-.5);a.uvx0=a.uvx+a.q8;a.uvy0=a.uvy+a.q8;a.uvz0=a.uvz+a.q8;for(c=0;8>c;c++)a.uvx=.00001<Math.abs(1<a.uvx?1:0)?2-a.uvx:.00001<Math.abs(-1>a.uvx?1:0)?-2-a.uvx:a.uvx,a.uvy=.00001<Math.abs(1<a.uvy?1:0)?2-a.uvy:.00001<Math.abs(-1>a.uvy?1:0)?-2-a.uvy:a.uvy,a.uvz=.00001<Math.abs(1<a.uvz?1:0)?2-a.uvz:.00001<Math.abs(-1>a.uvz?1:0)?-2-a.uvz:a.uvz,a.slen=
a.uvx*a.uvx+a.uvy*a.uvy+a.uvz*a.uvz,a.uvx=2.6*(.00001<Math.abs(.25>a.slen?1:0)?4*a.uvx:.00001<Math.abs(1>a.slen?1:0)?div(a.uvx,a.slen):a.uvx)+a.uvx0,a.uvy=2.6*(.00001<Math.abs(.25>a.slen?1:0)?4*a.uvy:.00001<Math.abs(1>a.slen?1:0)?div(a.uvy,a.slen):a.uvy)+a.uvy0,a.uvz=2.6*(.00001<Math.abs(.25>a.slen?1:0)?4*a.uvz:.00001<Math.abs(1>a.slen?1:0)?div(a.uvz,a.slen):a.uvz)+a.uvz0;a.len=sqrt(a.uvx*a.uvx+a.uvy*a.uvy+a.uvz*a.uvz);a.dist*=1.05;c=(.6>a.dist?1:0)*(30<a.len?1:0)}while(.00001<Math.abs(c)&&1048576>
d);d=.06>a.dist?1:0}while(.00001<Math.abs(d)&&1048576>b);
return a;},frame_eqs:function(a){
a.wave_a=0;a.fps_=0*a.fps_+1*(.00001<Math.abs(25>=a.fps?1:0)?a.fps:25+.5*(a.fps-25));a.dec_s=1-div(.06*30,a.fps_);a.beat=a.time>a.t0+3?1:0;a.t0=.00001<Math.abs(a.beat)?a.time:a.t0;a.speed=div(Math.min(.2,a.dist_-.02)*(1+2*a.avg)*(1-0*a.slow)*.7,a.q7);a.ds=a.ds*a.dec_s+div((1-a.dec_s)*a.speed*.25,a.fps_);a.rotz=.00001<Math.abs(.00001>Math.abs(a.rotz-0)?1:0)?a.beat*(randint(100)<20*a.travel?1:0)*(div(randint(10),10)-.3):bnot(a.beat*(30>randint(100)?1:0))*a.rotz;a.slow=.00001<
Math.abs(bnot(a.slow))?a.beat*(6>randint(1E3*a.avg)?1:0):bnot(a.beat*(50>randint(100)?1:0));a.look=.00001<Math.abs(bnot(a.look))?a.beat*(12>randint(1E3*a.speed)?1:0):bnot(a.beat*(50>randint(100)?1:0));a.lx=.00001<Math.abs(a.beat)?div(randint(150),200)+.15:a.lx;a.ly=.00001<Math.abs(a.beat)?div(randint(150),200)+.15:a.ly;a.lampx=a.lampx*a.dec_s+(1-a.dec_s)*(.00001<Math.abs(a.look)?a.lx:.5);a.lampy=a.lampy*a.dec_s+(1-a.dec_s)*(.00001<Math.abs(a.look)?a.ly:.5);a.q1=a.lampx;a.q2=a.lampy;a.dirx=a.reg26;
a.diry=a.reg27;a.dirz=a.reg28;a.posx+=a.ds*a.dirx;a.posy+=a.ds*a.diry;a.posz+=a.ds*a.dirz;a.q4=a.posx;a.q5=a.posy;a.q6=a.posz;a.angchg=(.2-a.dist_)*(.2>a.dist_?1:0)*2;a.travel=.00001<Math.abs(0<a.angchg?1:0)?0:a.travel+a.ds;a.v1=a.v1*a.dec_s+(1-a.dec_s)*a.rotz*a.ds;a.v2=a.v2*a.dec_s+div((1-a.dec_s)*a.angchg*a.xslope,a.fps_);a.v3=a.v3*a.dec_s+(1-a.dec_s)*(div(a.angchg*a.yslope,a.fps_)+2*a.v1*Math.sin(.1*a.time));a.reg30=a.reg20;a.reg31=a.reg21;a.reg32=a.reg22;a.reg33=a.reg23;a.reg34=a.reg24;a.reg35=
a.reg25;a.reg36=a.reg26;a.reg37=a.reg27;a.reg38=a.reg28;a.n=0;for(var b=a.avg=0;5>b;b++){a.n+=1;a.ran1=div(randint(100),100);a.ran2=div(randint(100),200)-.25;a.tx=Math.cos(1.57*a.n+a.ran2)*(4>=a.n?1:0)*a.ran1;a.ty=Math.sin(1.57*a.n+a.ran2)*(4>=a.n?1:0)*a.ran1;a.c1=Math.cos(a.v1);a.c2=Math.cos(a.v2+a.ty);a.c3=Math.cos(a.v3+a.tx);a.s1=Math.sin(a.v1);a.s2=Math.sin(a.v2+a.ty);a.s3=Math.sin(a.v3+a.tx);a.reg10=a.c2*a.c1;a.reg11=a.c2*a.s1;a.reg12=-a.s2;a.reg13=a.s3*a.s2*a.c1-a.c3*a.s1;a.reg14=a.s3*a.s2*
a.s1+a.c3*a.c1;a.reg15=a.s3*a.c2;a.reg16=a.c3*a.s2*a.c1+a.s3*a.s1;a.reg17=a.c3*a.s2*a.s1-a.s3*a.c1;a.reg18=a.c3*a.c2;a.reg20=a.reg30;a.reg21=a.reg31;a.reg22=a.reg32;a.reg23=a.reg33;a.reg24=a.reg34;a.reg25=a.reg35;a.reg26=a.reg36;a.reg27=a.reg37;a.reg28=a.reg38;a.q20=a.reg10*a.reg20+a.reg11*a.reg23+a.reg12*a.reg26;a.q21=a.reg10*a.reg21+a.reg11*a.reg24+a.reg12*a.reg27;a.q22=a.reg10*a.reg22+a.reg11*a.reg25+a.reg12*a.reg28;a.q23=a.reg13*a.reg20+a.reg14*a.reg23+a.reg15*a.reg26;a.q24=a.reg13*a.reg21+a.reg14*
a.reg24+a.reg15*a.reg27;a.q25=a.reg13*a.reg22+a.reg14*a.reg25+a.reg15*a.reg28;a.q26=a.reg16*a.reg20+a.reg17*a.reg23+a.reg18*a.reg26;a.q27=a.reg16*a.reg21+a.reg17*a.reg24+a.reg18*a.reg27;a.q28=a.reg16*a.reg22+a.reg17*a.reg25+a.reg18*a.reg28;a.reg20=a.q20;a.reg21=a.q21;a.reg22=a.q22;a.reg23=a.q23;a.reg24=a.q24;a.reg25=a.q25;a.reg26=a.q26;a.reg27=a.q27;a.reg28=a.q28;a.dist=.002;var c,d=0;do{d+=1;a.uvx=div(a.reg26*a.dist,a.q7);a.uvy=div(a.reg27*a.dist,a.q7);a.uvz=div(a.reg28*a.dist,a.q7);a.uvx+=a.posx;
a.uvy+=a.posy;a.uvz+=a.posz;a.uvx=8*(div(a.uvx,8)+30.5-Math.floor(div(a.uvx,8)+30.5)-.5);a.uvy=8*(div(a.uvy,8)+30.5-Math.floor(div(a.uvy,8)+30.5)-.5);a.uvz=8*(div(a.uvz,8)+30.5-Math.floor(div(a.uvz,8)+30.5)-.5);a.uvx0=a.uvx+a.q8;a.uvy0=a.uvy+a.q8;a.uvz0=a.uvz+a.q8;for(c=0;8>c;c++)a.uvx=.00001<Math.abs(1<a.uvx?1:0)?2-a.uvx:.00001<Math.abs(-1>a.uvx?1:0)?-2-a.uvx:a.uvx,a.uvy=.00001<Math.abs(1<a.uvy?1:0)?2-a.uvy:.00001<Math.abs(-1>a.uvy?1:0)?-2-a.uvy:a.uvy,a.uvz=.00001<Math.abs(1<a.uvz?1:0)?2-a.uvz:.00001<
Math.abs(-1>a.uvz?1:0)?-2-a.uvz:a.uvz,a.slen=a.uvx*a.uvx+a.uvy*a.uvy+a.uvz*a.uvz,a.uvx=2.6*(.00001<Math.abs(.25>a.slen?1:0)?4*a.uvx:.00001<Math.abs(1>a.slen?1:0)?div(a.uvx,a.slen):a.uvx)+a.uvx0,a.uvy=2.6*(.00001<Math.abs(.25>a.slen?1:0)?4*a.uvy:.00001<Math.abs(1>a.slen?1:0)?div(a.uvy,a.slen):a.uvy)+a.uvy0,a.uvz=2.6*(.00001<Math.abs(.25>a.slen?1:0)?4*a.uvz:.00001<Math.abs(1>a.slen?1:0)?div(a.uvz,a.slen):a.uvz)+a.uvz0;a.len=sqrt(a.uvx*a.uvx+a.uvy*a.uvy+a.uvz*a.uvz);a.dist*=1.1;c=(.6>a.dist?1:0)*(30<
a.len?1:0)}while(.00001<Math.abs(c)&&1048576>d);a.megabuf[Math.floor(a.n)]=a.megabuf[Math.floor(a.n)]*a.dec_s+(1-a.dec_s)*a.dist;a.avg+=Math.abs(div(a.megabuf[Math.floor(a.n)],5))}a.n=0;for(b=a.avg=0;5>b;b++)a.n+=1,a.avg+=Math.abs(div(a.megabuf[Math.floor(a.n)],5));a.xslope=Math.min(Math.max(div(2,a.avg)*(a.megabuf[1]-a.megabuf[3]),-3),3);a.yslope=Math.min(Math.max(div(2,a.avg)*(a.megabuf[4]-a.megabuf[2]),-3),3);a.monitor=a.avg;a.dist_=a.dist_*a.dec_s+(1-a.dec_s)*a.dist;a.q10=a.ds*a.q7;a.q14=Math.abs(a.ds)+
2*(Math.abs(a.v1)+Math.abs(a.v2)+Math.abs(a.v3))+div(1,255)+.05*a.start;a.q19=.6+.4*Math.sin(.02*a.time+6*a.cran0);a.start*=.9;a.q11=a.v1;a.q12=a.v2;a.q13=a.v3;a.monitor=a.q16;
return a;},pixel_eqs:function(a){
a.warp=0;a.zoom=1;a.dx=div(-a.q12,a.q16)*(1+0*pow(a.x-.5,2));a.dy=div(a.q13,a.q16)*(1+0*pow(a.y-.5,2));a.rot=a.q11;
return a;}}),
"ORB - Magma Pool":()=>Object.assign({"baseVals":{"rating":1,"decay":0.5,"echo_zoom":1,"echo_alpha":0.5,"echo_orient":3,"wave_mode":7,"solarize":1,"wave_a":0.001,"warpanimspeed":2.007,"warpscale":3.749,"zoomexp":1.0741,"zoom":1.0004,"warp":38.6131,"wave_r":0,"wave_g":0.4,"wave_b":0,"mv_a":0},"warp":" shader_body { \n  float final_noise_1;\n  mat2 tmpvar_2;\n  tmpvar_2[uint(0)].x = q5;\n  tmpvar_2[uint(0)].y = -(q4);\n  tmpvar_2[1u].x = q4;\n  tmpvar_2[1u].y = q5;\n  vec3 tmpvar_3;\n  tmpvar_3.xy = uv;\n  tmpvar_3.z = q2;\n  final_noise_1 = ((texture (sampler_noisevol_hq, (tmpvar_3 * \n    pow (q3, 0.0)\n  )) * 2.0) - 1.0).x;\n  final_noise_1 = (final_noise_1 + (0.5 * (\n    (texture (sampler_noisevol_hq, (tmpvar_3 * q3)) * 2.0)\n   - 1.0)).x);\n  final_noise_1 = (final_noise_1 + (0.25 * (\n    (texture (sampler_noisevol_hq, (tmpvar_3 * (q3 * q3))) * 2.0)\n   - 1.0)).x);\n  final_noise_1 = (final_noise_1 + (0.125 * (\n    (texture (sampler_noisevol_hq, (tmpvar_3 * pow (q3, 3.0))) * 2.0)\n   - 1.0)).x);\n  vec4 tmpvar_4;\n  tmpvar_4.w = 1.0;\n  tmpvar_4.xyz = (texture (sampler_main, ((\n    (((uv - 0.5) * tmpvar_2) * (1.0 - ((rad * 3.7) * (1.0 - \n      (bass_att * 0.3)\n    ))))\n   * final_noise_1) + 0.5)).xyz - 0.08);\n  ret = tmpvar_4.xyz;\n }","comp":" shader_body { \n  vec3 ret_1;\n  mat2 tmpvar_2;\n  tmpvar_2[uint(0)].x = q4;\n  tmpvar_2[uint(0)].y = -(q5);\n  tmpvar_2[1u].x = q5;\n  tmpvar_2[1u].y = q4;\n  vec2 tmpvar_3;\n  tmpvar_3 = (uv - 0.5);\n  ret_1 = (mix (texture (sampler_main, fract(\n    (((tmpvar_3 * tmpvar_2) * 0.9) + 0.5)\n  )).xyz, texture (sampler_main, fract(\n    ((((\n      (-(tmpvar_3) + 0.5)\n     - 0.5) * -(tmpvar_2)) * 0.9) + 0.5)\n  )).xyz, vec3(0.5, 0.5, 0.5)) * 2.0);\n  vec3 tmpvar_4;\n  tmpvar_4.x = (ret_1.x * 10.0);\n  tmpvar_4.y = ret_1.y;\n  tmpvar_4.z = -(ret_1.z);\n  ret_1 = tmpvar_4;\n  vec4 tmpvar_5;\n  tmpvar_5.w = 1.0;\n  tmpvar_5.xyz = tmpvar_4;\n  ret = tmpvar_5.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"textured":1,"rad":2.66718,"tex_zoom":0.37409,"g":1,"b":1,"a":0.8,"r2":1,"b2":1,"a2":0.4}},{init_eqs:function(a){
a.basstime=0;a.ob_r=0;a.ob_g=0;a.ob_b=0;
return a;},frame_eqs:function(a){
a.ang=a.basstime;a.tex_ang=Math.sin(a.basstime);a.ob_r=.5*Math.sin(1.12*a.basstime);a.ob_g=.5*Math.sin(1.5*a.basstime);a.ob_b=.5*Math.sin(2.12*a.basstime);
return a;}}),Object.assign({"baseVals":{"enabled":1,"textured":1,"rad":2.66718,"tex_zoom":0.37713,"g":1,"b":1,"a":0.7,"r2":0.8,"b2":1,"a2":0.5}},{init_eqs:function(a){
a.tex_capture=0;
return a;},frame_eqs:function(a){
a.tex_capture=above(a.bass,1);
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":100,"g2":0.8,"b2":1,"a2":1,"border_a":0}},{init_eqs:function(a){
a.q5=0;
return a;},frame_eqs:function(a){
a.b2=Math.sin(.4*a.q5);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.basstime=0;a.stickybit=0;a.volavg2=0;a.q6=0;a.q1=0;a.q5=0;a.sample1=0;a.diff=0;a.edge=0;a.q4=0;a.volavg=0;a.bit2=0;a.vol=0;a.q2=0;a.q3=0;a.basssum=0;a.sample2=0;
return a;},frame_eqs:function(a){
a.basstime+=.006*a.bass;a.q2=a.basstime;a.q1=.001*a.basstime;a.q4=Math.cos(a.basstime);a.q5=Math.sin(a.basstime);a.vol=pow(a.bass+a.mid+a.treb,2);a.basssum=a.vol;a.stickybit=mod(a.time,2);a.volavg+=a.vol*equal(a.stickybit,1);a.sample1+=equal(a.stickybit,1);a.volavg2+=a.vol*equal(a.stickybit,0);a.sample2+=equal(a.stickybit,0);a.edge=bnot(equal(a.bit2,a.stickybit));a.volavg-=a.volavg*a.edge*a.stickybit;a.volavg2-=a.volavg2*a.edge*equal(a.stickybit,0);a.sample1-=a.sample1*a.edge*
a.stickybit;a.sample2-=a.sample2*a.edge*equal(a.stickybit,0);a.diff=.00001<Math.abs(equal(a.stickybit,1))?div(a.basssum,div(a.volavg2,a.sample2)):0;a.diff=.00001<Math.abs(equal(a.stickybit,0))?div(a.basssum,div(a.volavg,a.sample1)):a.diff;a.q3=0;a.q6=a.diff;a.bit2=mod(a.time,2);a.monitor=5*(a.diff-1);
return a;},pixel_eqs:function(a){
a.zoom=.2;a.rot=0;
return a;}}),
"phat + Eo.S. - Bass_responce_Red_Movements_Disorienting nebula3":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.7,"decay":1,"echo_zoom":2.220753,"wave_mode":3,"additivewave":1,"wave_thick":1,"wrap":0,"darken":1,"wave_a":0.001,"wave_scale":0.625316,"wave_smoothing":0.9,"modwavealphastart":0.88,"modwavealphaend":1.98,"warpanimspeed":0.010284,"warpscale":0.01,"fshader":1,"dx":0.005,"warp":0.01,"sx":0.9999,"sy":1.0018,"wave_r":0,"wave_g":0,"wave_b":0,"ob_size":0,"ob_g":0.8,"ob_b":0.7,"ib_size":0.005,"ib_r":0,"ib_g":0,"ib_b":0.3,"mv_x":64,"mv_y":48,"mv_l":1,"mv_b":0.9,"mv_a":0},"pixel_eqs":"","warp":"","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":5,"thickoutline":1,"rad":0.414899,"tex_ang":0.251327,"tex_zoom":1.136001,"r":0.36,"g2":0,"b2":0.2,"border_r":0,"border_g":0,"border_b":0,"border_a":0}},{init_eqs:function(a){
a.adv=0;
return a;},frame_eqs:function(a){
a.adv+=div(a.bass*a.bass,15);a.r=.05*randint(10)+.5;a.g=a.r;a.b=a.r;a.x=.005*randint(100)+.25;a.y=.005*randint(100)+.25;a.rad=.004*randint(100)+.1;a.ang=a.rad;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"sep":256,"usedots":1,"additive":1,"scaling":100,"smoothing":0.9,"r":0,"g":0.7}},{init_eqs:function(a){
a.s=0;a.xp=0;a.yp=0;a.zp=0;a.t1=0;a.x_screen=0;a.y_screen=0;a.advance=0;
return a;},frame_eqs:function(a){
a.advance+=.012;a.advance=.00001<Math.abs(above(a.advance,2))?0:a.advance;a.t1=a.advance;
return a;},point_eqs:function(a){
a.s=6.28*a.sample;a.xp=Math.sin(a.s)+Math.sin(.34*a.s)+Math.sin(24.3*a.s)+Math.sin(13.8*a.s);a.xp*=.2;a.yp=Math.cos(a.s)+Math.sin(.24*a.s)+Math.cos(17.4*a.s)+Math.sin(37.7*a.s);a.yp*=.2;a.zp=Math.cos(a.s)+Math.cos(5.24*a.s)+Math.cos(47.4*a.s)+Math.cos(27.7*a.s);a.zp*=.25;a.zp=a.zp+1-a.t1;a.zp=.00001<Math.abs(below(a.zp,0))?a.zp+2:a.zp;a.a=1-.5*a.zp;a.zp*=.7;a.x_screen=div(a.xp,a.zp)+.5;a.y_screen=div(a.yp,a.zp)+.5;a.x=a.x_screen;a.y=a.y_screen;a.r=1;a.g=.9;a.b=1;
return a;}}),Object.assign({"baseVals":{"enabled":1,"samples":42,"usedots":1,"additive":1,"scaling":81.954445,"smoothing":1}},{init_eqs:function(a){
a.s=0;a.xp=0;a.yp=0;a.zp=0;a.t1=0;a.x_screen=0;a.y_screen=0;a.advance=0;
return a;},frame_eqs:function(a){
a.advance+=.012;a.advance=.00001<Math.abs(above(a.advance,2))?0:a.advance;a.t1=a.advance;
return a;},point_eqs:function(a){
a.s=6.28*a.sample;a.xp=Math.sin(a.s)+Math.sin(.34*a.s)+Math.cos(24.3*a.s)+Math.sin(13.8*a.s);a.xp*=.2;a.yp=Math.cos(a.s)+Math.sin(1.24*a.s)+Math.cos(17.4*a.s)+Math.sin(37.7*a.s);a.yp*=.2;a.zp=Math.cos(a.s)+Math.cos(3.24*a.s)+Math.cos(47.4*a.s)+Math.cos(27.7*a.s);a.zp*=.25;a.zp=a.zp+1-a.t1;a.zp=.00001<Math.abs(below(a.zp,0))?a.zp+2:a.zp;a.a=1-.5*a.zp;a.zp*=.7;a.x_screen=div(a.xp,a.zp)+.5;a.y_screen=div(a.yp,a.zp)+.5;a.x=a.x_screen;a.y=a.y_screen;a.r=1;a.g=.9;a.b=1;
return a;}}),Object.assign({"baseVals":{"enabled":1,"samples":42,"usedots":1,"thick":1,"additive":1,"a":0.360001}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.x=.001*randint(1E3);a.y=.001*randint(1E3);a.r=.9;a.g=1;a.b=1;
return a;}}),Object.assign({"baseVals":{"enabled":1,"samples":192,"usedots":1,"additive":1,"a":0.320001}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.x=.001*randint(1E3);a.y=.001*randint(1E3);a.r=1;a.g=1;a.b=.9;
return a;}})],init_eqs:function(a){
a.mv_x=64;a.mv_y=48;a.nut=0;a.stp=0;a.stq=0;a.rtp=0;a.rtq=0;a.wvr=0;a.decay=0;a.dcsp=0;
return a;},frame_eqs:function(a){
a.decay=1;a.zoom=1.009;a.dx=0;a.dy=0;a.sx=1.000001;a.sy=.999999;a.mv_r=.36+.1*(.3*Math.cos(div(a.time,5))+.25);a.mv_g=.39+.1*(.3*Math.sin(div(a.time,7))+.25);a.mv_b=.5+.1*(Math.sin(div(a.time,7)+.9)+.25);a.cx=-1;a.cy=2;a.rot=.002*-a.treb;a.cx=1.5*Math.sin(.1*a.time)+.5;a.cy=1.5*Math.cos(.2*a.time)+.5;
return a;},pixel_eqs:''}),
"Rocke - Answer.42 (New Mix 1) - mash0000 - slash and char p. jungle":()=>Object.assign({"baseVals":{"rating":1,"gammaadj":1.998,"decay":0.993,"wave_mode":1,"additivewave":1,"darken":1,"wave_a":5.9,"wave_scale":0.75,"wave_smoothing":0.9,"warpanimspeed":5.003,"warpscale":0.01,"zoom":0.96194,"rot":-0.01,"warp":0.39986,"wave_r":0.9,"wave_g":0.45,"wave_b":0,"ob_a":1,"ib_r":1,"ib_g":1,"mv_x":63.936,"mv_y":19.2,"mv_l":5,"mv_r":0.5,"mv_g":0,"mv_a":0.1},"warp":" shader_body { \n  vec2 my_uv_1;\n  vec3 ret_2;\n  vec2 tmpvar_3;\n  tmpvar_3 = (vec2(1280.0, 1024.0) * texsize.zw);\n  float tmpvar_4;\n  vec2 tmpvar_5;\n  tmpvar_5 = (uv + vec2(0.005, 0.0));\n  vec2 tmpvar_6;\n  tmpvar_6 = (uv - vec2(0.005, 0.0));\n  tmpvar_4 = (((\n    (texture (sampler_blur2, tmpvar_5).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, tmpvar_6).xyz * scale2)\n   + bias2)).x * tmpvar_3.x);\n  float tmpvar_7;\n  vec2 tmpvar_8;\n  tmpvar_8 = (uv + vec2(0.0, 0.005));\n  vec2 tmpvar_9;\n  tmpvar_9 = (uv - vec2(0.0, 0.005));\n  tmpvar_7 = (((\n    (texture (sampler_blur2, tmpvar_8).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, tmpvar_9).xyz * scale2)\n   + bias2)).x * tmpvar_3.y);\n  vec2 tmpvar_10;\n  tmpvar_10.x = tmpvar_4;\n  tmpvar_10.y = tmpvar_7;\n  vec2 tmpvar_11;\n  tmpvar_11.x = (((\n    (texture (sampler_blur2, tmpvar_5).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, tmpvar_6).xyz * scale2)\n   + bias2)).x * tmpvar_3.x);\n  tmpvar_11.y = (((\n    (texture (sampler_blur2, tmpvar_8).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, tmpvar_9).xyz * scale2)\n   + bias2)).x * tmpvar_3.y);\n  ret_2.x = texture (sampler_fw_main, ((uv - (tmpvar_10 * 0.01)) + (tmpvar_11 * 0.003))).x;\n  vec4 tmpvar_12;\n  tmpvar_12 = texture (sampler_blur3, uv);\n  ret_2.x = (ret_2.x + ((ret_2.x - \n    ((tmpvar_12.xyz * scale3) + bias3)\n  .x) * 0.1));\n  ret_2.x = (ret_2.x + 0.004);\n  vec2 tmpvar_13;\n  tmpvar_13.x = tmpvar_7;\n  tmpvar_13.y = -(tmpvar_4);\n  my_uv_1 = (uv + ((tmpvar_13 * 0.05) * (1.2 - \n    ((tmpvar_12.xyz * scale3) + bias3)\n  .y)));\n  ret_2.z = texture (sampler_fw_main, my_uv_1).z;\n  vec2 x_14;\n  x_14 = (my_uv_1 - uv);\n  ret_2.z = (ret_2.z + ((\n    ((ret_2.z - ((texture (sampler_blur1, uv).xyz * scale1) + bias1).z) * sqrt(dot (x_14, x_14)))\n   * 180.0) / sqrt(\n    dot (tmpvar_3, tmpvar_3)\n  )));\n  ret_2.z = (ret_2.z * 0.8);\n  ret_2.z = (ret_2.z + 0.004);\n  vec2 tmpvar_15;\n  tmpvar_15.x = -(tmpvar_7);\n  tmpvar_15.y = tmpvar_4;\n  my_uv_1 = (tmpvar_15 * 0.045);\n  vec2 tmpvar_16;\n  tmpvar_16.x = (((\n    (texture (sampler_blur2, (uv + vec2(0.01, 0.0))).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, (uv - vec2(0.01, 0.0))).xyz * scale2)\n   + bias2)).y * tmpvar_3.x);\n  tmpvar_16.y = (((\n    (texture (sampler_blur2, (uv + vec2(0.0, 0.01))).xyz * scale2)\n   + bias2) - (\n    (texture (sampler_blur2, (uv - vec2(0.0, 0.01))).xyz * scale2)\n   + bias2)).y * tmpvar_3.y);\n  my_uv_1 = (my_uv_1 + (uv - (tmpvar_16 * 0.03)));\n  ret_2.y = texture (sampler_fw_main, my_uv_1).y;\n  ret_2.y = (ret_2.y + ((\n    (ret_2.y - ((texture (sampler_blur3, my_uv_1).xyz * scale3) + bias3).y)\n   * 0.1) + 0.01));\n  vec4 tmpvar_17;\n  tmpvar_17.w = 1.0;\n  tmpvar_17.xyz = ret_2;\n  ret = tmpvar_17.xyz;\n }","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.obj=0;
return a;},frame_eqs:function(a){
a.wave_r+=.1*(.6*Math.sin(.933*a.time)+.4*Math.sin(1.072*a.time));a.wave_g+=.05*(.6*Math.sin(.888*a.time)+.4*Math.sin(.918*a.time));a.wave_b+=.2*(.6*Math.sin(.335*a.time)+.4*Math.sin(.4*a.time));a.wave_mystery=.5*Math.sin(.35*a.bass);a.decay-=.01*equal(mod(a.frame,50),0);
return a;},pixel_eqs:function(a){
a.obj=.05+.05*Math.sin(.2*a.time);a.zoom+=a.obj*a.rad;a.rot-=.15*Math.sin(a.ang);
return a;}}),
"Rovastar + Geiss - Hurricane Nightmare (Gold Chrome Mix)":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1,"decay":1,"echo_zoom":1,"echo_orient":3,"wave_mode":1,"wave_thick":1,"wrap":0,"darken_center":1,"wave_a":0.3,"wave_scale":0.881,"wave_smoothing":0.5,"wave_mystery":-1,"warpscale":2.853,"zoomexp":3.6,"zoom":1.02109,"rot":-0.16,"warp":0.309,"wave_r":0.6,"wave_g":0.6,"wave_b":0.6,"wave_y":0.47,"mv_l":1.75},"warp":"","comp":" shader_body { \n  vec3 ret_1;\n  vec4 tmpvar_2;\n  tmpvar_2 = texture (sampler_main, uv);\n  ret_1 = (((vec3(1.1, 0.8, 0.7) * tmpvar_2.x) + (vec3(0.4, 0.6, 0.55) * tmpvar_2.y)) + (vec3(0.7, 0.6, 0.3) * tmpvar_2.z));\n  ret_1 = (ret_1 * 0.4);\n  ret_1 = ((ret_1 * ret_1) * (1.0 + (\n    clamp (((cos(\n      (((dot (tmpvar_2.xyz, vec3(0.32, 0.49, 0.29)) * 17.0) + 3.0) + (uv.x * 30.0))\n    ) * 3.0) - 2.7), 0.0, 1.0)\n   * 4.0)));\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = ret_1;\n  ret = tmpvar_3.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.q8=0;a.oldq8=0;
return a;},frame_eqs:function(a){
a.wave_r+=.4*(.6*Math.sin(.933*a.time)+.4*Math.sin(1.045*a.time));a.wave_g+=.4*(.6*Math.sin(.9*a.time)+.4*Math.sin(.956*a.time));a.wave_b+=.4*(.6*Math.sin(.91*a.time)+.4*Math.sin(.92*a.time));a.q8=a.oldq8+(.00001<Math.abs(above(a.bass+a.bass_att,1.8))?a.q8+.0005*pow(a.bass+a.bass_att-1,9):0);a.oldq8=a.q8;a.monitor=a.q8;a.zoom+=.023*(.6*Math.sin(.339*a.q8)+.4*Math.sin(.276*a.q8));a.rot+=.03*(.6*Math.sin(.381*a.q8)+.4*Math.sin(.579*a.q8));a.mv_r=a.wave_r;a.mv_b=a.wave_b;a.mv_g=
a.wave_g;a.mv_x=1.25;a.mv_y=1.25;a.mv_dx=.1*Math.sin(1.1*a.time);a.mv_dy=.1*Math.cos(1.112*a.time);
return a;},pixel_eqs:function(a){
a.rot+=div(1,10*(a.rad+.2+.1*Math.sin(a.q8)));
return a;}}),
"Rovastar + Geiss - Hyperkaleidoscope Glow 2 motion blur (Jelly)":()=>Object.assign({"baseVals":{"rating":1,"decay":0.973,"echo_zoom":1.047,"wave_mode":3,"wave_dots":1,"wrap":0,"darken_center":1,"darken":1,"wave_a":0.9,"wave_scale":2.905,"wave_smoothing":0.627,"wave_mystery":-0.3,"warpscale":2.853,"zoomexp":1.23219,"zoom":1.08017,"warp":0.01678,"wave_r":0.6,"wave_g":0.6,"wave_b":0.6,"ob_size":0,"mv_x":64,"mv_y":48,"mv_l":0,"mv_r":0.35,"mv_g":0.35,"mv_b":0.35,"b1n":0.67},"warp":" shader_body { \n  vec3 ret_1;\n  ret_1 = texture (sampler_main, uv).xyz;\n  vec2 tmpvar_2;\n  tmpvar_2 = (normalize((uv - uv_orig)) * texsize.zw);\n  vec4 tmpvar_3;\n  tmpvar_3.w = 0.0;\n  tmpvar_3.xyz = ret_1;\n  vec4 tmpvar_4;\n  tmpvar_4.w = 0.0;\n  tmpvar_4.xyz = max (tmpvar_3, (texture (sampler_main, (uv + tmpvar_2)) * 0.97)).xyz;\n  vec4 tmpvar_5;\n  tmpvar_5.w = 0.0;\n  tmpvar_5.xyz = max (tmpvar_4, (texture (sampler_main, (uv - tmpvar_2)) * 0.97)).xyz;\n  vec4 tmpvar_6;\n  tmpvar_6.w = 0.0;\n  tmpvar_6.xyz = max (tmpvar_5, (texture (sampler_main, (uv + \n    (tmpvar_2 * 2.0)\n  )) * 0.9)).xyz;\n  ret_1 = (max (tmpvar_6, (texture (sampler_main, \n    (uv - (tmpvar_2 * 2.0))\n  ) * 0.9)).xyz * 0.95);\n  vec4 tmpvar_7;\n  tmpvar_7.w = 1.0;\n  tmpvar_7.xyz = ret_1;\n  ret = tmpvar_7.xyz;\n }","comp":" shader_body { \n  vec2 uv2_1;\n  vec3 ret_2;\n  uv2_1 = (uv + (vec2(1.0, 0.0) * texsize.zw));\n  float tmpvar_3;\n  tmpvar_3 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(-1.0, 0.0) * texsize.zw));\n  float tmpvar_4;\n  tmpvar_4 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, 1.0) * texsize.zw));\n  float tmpvar_5;\n  tmpvar_5 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, -1.0) * texsize.zw));\n  vec3 tmpvar_6;\n  tmpvar_6.z = 0.14;\n  tmpvar_6.x = (tmpvar_3 - tmpvar_4);\n  tmpvar_6.y = (tmpvar_5 - ((\n    (texture (sampler_main, uv2_1).xyz + (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4))\n   + \n    (((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2) * 0.15)\n  ) + (\n    ((texture (sampler_blur3, uv2_1).xyz * scale3) + bias3)\n   * 0.1)).x);\n  ret_2 = (0.5 + (0.5 * normalize(tmpvar_6)));\n  vec2 x_7;\n  x_7 = (ret_2.xy - 0.5);\n  ret_2 = (ret_2 * clamp ((\n    sqrt(dot (x_7, x_7))\n   * 5.0), 0.0, 1.0));\n  ret_2 = ret_2.xxy;\n  ret_2 = (ret_2 + 1.15);\n  ret_2 = (ret_2 * mix (ret_2, (ret_2 * \n    (((texture (sampler_blur3, uv).xyz * scale3) + bias3) - ((texture (sampler_blur1, uv).xyz * scale1) + bias1))\n  ), pow (hue_shader.zyx, ret_2)));\n  ret_2 = (ret_2 * ret_2);\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_2;\n  ret = tmpvar_8.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.q1=0;a.q2=0;a.oldq2=0;
return a;},frame_eqs:function(a){
a.wave_r+=.4*(.6*Math.sin(.933*a.time)+.4*Math.sin(1.045*a.time));a.wave_g+=.1*(.6*Math.sin(.9*a.time)+.4*Math.sin(.956*a.time));a.wave_b+=.1*(.6*Math.sin(.91*a.time)+.4*Math.sin(.92*a.time));a.mv_r=a.wave_r;a.mv_b=a.wave_b;a.mv_g=a.wave_g;a.q1=.05*div(pow(1+1.2*a.bass+.4*a.bass_att+.1*a.treb+.1*a.treb_att+.1*a.mid+.1*a.mid_att,6),a.fps);a.mv_a=.00001<Math.abs(above(a.bass-1.2,1))?1:a.bass-1.2;a.q2=a.oldq2+.05*div(pow(1+1.2*a.treb+.4*a.treb_att+.1*a.treb+.1*a.treb_att+.1*a.mid+
.1*a.mid_att,6),a.fps);a.oldq2=a.q2;a.monitor=a.q2;
return a;},pixel_eqs:function(a){
a.zoom+=.1*a.rad*a.q1;
return a;}}),
"Rovastar + Geiss - Snapshot Of Space (LSB mix)":()=>Object.assign({"baseVals":{"rating":0,"decay":0.981,"echo_zoom":1.047,"wave_mode":3,"wave_dots":1,"wave_thick":1,"wrap":0,"darken":1,"wave_a":0.9,"wave_scale":2.905,"wave_smoothing":0.6,"wave_mystery":-0.3,"warpscale":2.853,"zoomexp":2.63006,"zoom":1.031,"warp":0,"wave_r":0.6,"wave_g":0.6,"wave_b":0.6,"ob_size":0,"ob_a":1,"mv_x":24.986,"mv_y":20.031,"mv_dx":0.065,"mv_dy":0.109,"mv_l":0.036,"mv_r":0.816,"mv_g":0.099,"mv_b":0.816,"mv_a":0},"warp":"","comp":" shader_body { \n  vec3 ret_1;\n  vec3 tmpvar_2;\n  tmpvar_2.z = 0.0;\n  tmpvar_2.xy = texsize.zw;\n  ret_1 = -(texture (sampler_main, uv).xyz);\n  ret_1 = (ret_1 + (clamp (\n    ((dot (texture (sampler_main, (uv + tmpvar_2.xz)).xyz, vec3(0.32, 0.49, 0.29)) - dot (texture (sampler_main, (uv - tmpvar_2.xz)).xyz, vec3(0.32, 0.49, 0.29))) * 64.0)\n  , 0.0, 1.0) * vec3(1.0, 0.6, 0.1)));\n  ret_1 = (ret_1 + (clamp (\n    ((dot (texture (sampler_main, (uv + tmpvar_2.zy)).xyz, vec3(0.32, 0.49, 0.29)) - dot (texture (sampler_main, (uv - tmpvar_2.zy)).xyz, vec3(0.32, 0.49, 0.29))) * 64.0)\n  , 0.0, 1.0) * vec3(0.2, 0.5, 0.7)));\n  ret_1 = (ret_1 - clamp ((\n    (((texture (sampler_blur1, uv).xyz * scale1) + bias1) * 4.0)\n   - 1.0), 0.0, 1.0));\n  ret_1 = (ret_1 * 1.5);\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = ret_1;\n  ret = tmpvar_3.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.q1=0;a.q8=0;a.oldq8=0;a.bass_thresh=0;a.q5_residual=0;a.q6_residual=0;
return a;},frame_eqs:function(a){
a.wave_r+=.4*(.6*Math.sin(.933*a.time)+.4*Math.sin(1.045*a.time));a.wave_g+=.1*(.6*Math.sin(.9*a.time)+.4*Math.sin(.956*a.time));a.wave_b+=.1*(.6*Math.sin(.91*a.time)+.4*Math.sin(.92*a.time));a.mv_r=a.wave_r;a.mv_b=a.wave_b;a.mv_g=a.wave_g;a.q8=a.oldq8+.0003*div(pow(1+1.2*a.bass+.4*a.bass_att+.1*a.treb+.1*a.treb_att+.1*a.mid+.1*a.mid_att,6),a.fps);a.oldq8=a.q8;a.bass_thresh=2*above(a.bass_att,a.bass_thresh)+(1-above(a.bass_att,a.bass_thresh))*(.96*(a.bass_thresh-1.3)+1.3);a.q5_residual=
.0064*equal(a.bass_thresh,2)*Math.sin(5*a.q8)+(1-equal(a.bass_thresh,2))*a.q5_residual;a.q6_residual=.0048*equal(a.bass_thresh,2)*Math.sin(6*a.q8)+(1-equal(a.bass_thresh,2))*a.q6_residual;a.dx=a.q5_residual;a.dy=a.q6_residual;a.q1=.03*div(pow(1+1.2*a.bass+.4*a.bass_att+.1*a.treb+.1*a.treb_att+.1*a.mid+.1*a.mid_att,6),a.fps);a.monitor=a.q1;a.mv_a=a.bass-1.2;
return a;},pixel_eqs:function(a){
a.zoom=.9+.1*a.q1+.1*a.rad;a.zoomexp=2*a.zoom;
return a;}}),
"shifter - dark tides bdrv mix 2":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.35,"decay":1,"echo_zoom":2.144269,"echo_alpha":0.31,"echo_orient":3,"wave_mode":7,"wave_brighten":0,"wrap":0,"wave_a":4.1,"wave_scale":5.552,"wave_smoothing":0.504,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":1.331,"zoom":0.999514,"cx":-1,"warp":0.72142,"sy":0.980296,"wave_g":0,"wave_b":0,"ob_size":0.5,"ob_r":1,"ib_size":0.5,"ib_r":1,"ib_g":0,"ib_b":0,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0},"warp":" shader_body { \n  vec3 ret_1;\n  ret_1 = ((texture (sampler_main, uv_orig).xyz * vec3(0.97, 1.0, 0.97)) - vec3(0.03, 0.0, 0.03));\n  vec4 tmpvar_2;\n  tmpvar_2 = texture (sampler_blur1, uv_orig);\n  ret_1.z = (ret_1.z + ((\n    (tmpvar_2.xyz * scale1)\n   + bias1).z * 0.45));\n  ret_1.x = (ret_1.x + ((\n    ((tmpvar_2.xyz * scale1) + bias1)\n  .z * 0.05) + (\n    ((texture (sampler_blur3, uv_orig).xyz * scale3) + bias3)\n  .z * 0.05)));\n  ret_1.z = (ret_1.z - ret_1.x);\n  ret_1.y = clamp (texture (sampler_pw_main, uv_orig).y, 0.0, 1.0);\n  ret_1 = (ret_1 * 0.98);\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = ret_1;\n  ret = tmpvar_3.xyz;\n }","comp":" shader_body { \n  vec3 ret_1;\n  vec3 tmpvar_2;\n  tmpvar_2.z = 0.0;\n  tmpvar_2.xy = texsize.zw;\n  vec3 tmpvar_3;\n  tmpvar_3 = (tmpvar_2 * 2.5);\n  ret_1 = (texture (sampler_main, uv).xyz * 0.5);\n  ret_1 = (ret_1 + (vec3(3.4, 2.38, 1.02) * (\n    dot (((texture (sampler_blur1, (uv + tmpvar_3.xz)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n   - \n    dot (((texture (sampler_blur1, (uv - tmpvar_3.xz)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n  )));\n  ret_1 = (ret_1 + (vec3(0.68, 1.7, 2.38) * (\n    dot (((texture (sampler_blur1, (uv + tmpvar_3.zy)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n   - \n    dot (((texture (sampler_blur1, (uv - tmpvar_3.zy)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n  )));\n  ret_1 = (ret_1 * 1.5);\n  vec4 tmpvar_4;\n  tmpvar_4.w = 1.0;\n  tmpvar_4.xyz = ret_1;\n  ret = tmpvar_4.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":5,"textured":1,"rad":0.98608,"tex_ang":3.14159,"tex_zoom":0.999794,"g":1,"b":1,"r2":1,"b2":1,"a2":1,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.ang=Math.sin(div(a.time,65));
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.bl=0;a.tic=0;a.swi=0;a.q6=0;a.it=0;a.q1=0;a.q5=0;a.bvb=0;a.itar=0;a.mid_avg=0;a.tin=0;a.bass_avg=0;a.vav=0;a.rate=0;a.bd=0;a.q4=0;a.cha=0;a.ra=0;a.treb_avg=0;a.ul=0;a.db=0;a.gv=0;a.q2=0;a.iter=0;a.q3=0;a.vm=0;a.cma=0;a.cm=0;a.rb=0;
return a;},frame_eqs:function(a){
a.bl=3.8;a.ul=7.9;a.rate=11.9;a.cha=.01;a.gv=.00001<Math.abs(above(a.gv,a.bl))?.00001<Math.abs(below(a.gv,a.ul))?.00001<Math.abs(above(a.fps,a.rate))?a.gv+a.cha:a.gv-a.cha:a.ul-.1:a.bl+.1;a.monitor=a.gv;a.wave_a=0;a.tic=Math.min(a.time-a.tin,1);a.tin=a.time;a.ra=10;a.treb_avg=a.tic*(a.treb_avg*(div(1,a.tic)-a.ra)+a.ra*a.treb);a.mid_avg=a.tic*(a.mid_avg*(div(1,a.tic)-a.ra)+a.ra*a.mid);a.bass_avg=a.tic*(a.bass_avg*(div(1,a.tic)-a.ra)+a.ra*a.bass);a.rb=1;a.vav=a.tic*(a.vav*(div(1,
a.tic)-a.rb)+a.rb*(a.bass+a.treb+a.mid)*.33333);a.q1=a.treb_avg;a.q2=a.mid_avg;a.q3=a.bass_avg;a.db=a.bass-a.bass_avg;a.it=(a.it+a.tic)*below(a.it,1);a.rb=.5*div(1,a.tic);a.bvb=a.tic*(a.bass*a.rb+(div(1,a.tic)-a.rb)*a.bvb);a.bd=a.bass-a.bvb;a.vm=a.vm-a.tic+a.swi;a.swi=above(a.bd-a.vm,0);a.q4=1-a.swi;a.cm=.00001<Math.abs(above(a.iter,30)+equal(a.time,0))?randint(3)+1:a.cm;a.iter=(a.iter+a.tic)*(1-above(a.iter,30));a.q5=.00001<Math.abs(equal(a.cm,0))?3:a.cm;a.cma=.00001<Math.abs(above(a.itar,5)+equal(a.time,
0))?Math.floor(5*a.vav):a.cma;a.itar=(a.itar+a.tic)*(1-above(a.itar,5));a.q6=Math.floor(5*a.vav);a.decay=.97;a.zoom=1.01;a.sx=1;a.sy=1;
return a;},pixel_eqs:function(a){
a.warp=a.bass;
return a;}}),
"shifter - escape the worm - Eo.S. + Phat - Before_It_Eats_Your_Brain_Mix_v2":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1,"decay":1,"echo_zoom":1.999894,"wave_mode":7,"additivewave":1,"modwavealphabyvolume":1,"wave_brighten":0,"wrap":0,"brighten":1,"darken":1,"wave_a":0.001,"wave_scale":1.285751,"wave_smoothing":0.63,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":1.331,"zoomexp":0.9999,"zoom":0.999514,"warp":0.01,"wave_r":0.65,"wave_g":0.65,"wave_b":0.65,"ob_size":0.005,"ob_a":0.3,"ib_size":0.26,"mv_x":6.399996,"mv_y":4.800006,"mv_l":1,"mv_g":0.91,"mv_b":0.71,"mv_a":0},"warp":"","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":20,"rad":0.275918,"r":0,"a":0.08,"g2":0,"border_a":0}},{init_eqs:function(a){
a.q1=0;a.q2=0;
return a;},frame_eqs:function(a){
a.x=a.q1;a.y=1-a.q2;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":3,"textured":1,"rad":0.59958,"tex_ang":1.256637,"tex_zoom":0.01,"g":1,"a":0,"r2":1,"b2":1,"a2":0.85,"border_g":0,"border_b":0,"border_a":0}},{init_eqs:function(a){
a.q1=0;a.q2=0;a.q6=0;a.q7=0;a.flux=0;
return a;},frame_eqs:function(a){
a.x=a.q1;a.y=1-a.q2;a.ang=.785398-50*a.q6-8*a.time;a.rad*=2*Math.max(.2-.1*a.q7,0);a.flux=Math.sin(2.1*a.time);a.flux*=above(a.flux,.95);a.flux=20*(a.flux-.95);a.flux=Math.max(a.flux,0);a.flux=pow(a.flux,1.3);a.rad+=.2*a.flux;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":3,"additive":1,"textured":1,"rad":0.542619,"tex_zoom":0.01,"g":1,"b":1,"r2":1,"b2":1,"a2":1,"border_a":1}},{init_eqs:function(a){
a.q1=0;a.q2=0;a.q6=0;a.q7=0;a.flux=0;
return a;},frame_eqs:function(a){
a.x=a.q1;a.y=1-a.q2;a.ang=-.261799-50*a.q6-8*a.time;a.rad*=2*Math.max(.2-.1*a.q7,0);a.flux=Math.sin(2.1*a.time);a.flux*=above(a.flux,.95);a.flux=20*(a.flux-.95);a.flux=Math.max(a.flux,0);a.flux=pow(a.flux,1.3);a.rad+=.2*a.flux;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":6,"thickoutline":1,"textured":1,"rad":0.090529,"tex_zoom":0.819542,"g":1,"b":1,"r2":1,"b2":1,"border_r":0,"border_g":0,"border_b":0,"border_a":0}},{init_eqs:function(a){
a.q1=0;a.q2=0;a.q6=0;a.q7=0;a.flux=0;
return a;},frame_eqs:function(a){
a.x=a.q1;a.y=1-a.q2;a.ang=.261799-50*a.q6;a.rad=.7*Math.max(.2-.1*a.q7,0);a.tex_ang=8*a.time;a.flux=Math.sin(2.1*a.time);a.flux*=above(a.flux,.95);a.flux=20*(a.flux-.95);a.flux=Math.max(a.flux,0);a.flux=pow(a.flux,1.3);a.rad+=.2*a.flux;
return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":1,"sep":51,"usedots":1,"thick":1,"scaling":1.32735,"smoothing":0.82,"b":3}},{init_eqs:function(a){
a.sw=0;a.t1=0;a.it=0;a.r1=0;a.fluy=0;a.vx=0;a.flux=0;a.vy=0;a.ry=0;a.xfade2=0;a.xfade=0;a.rx=0;a.tm=0;a.g1=0;a.b1=0;
return a;},frame_eqs:function(a){
a.t1=.5*Math.sin(.236*a.time)+.5;
return a;},point_eqs:function(a){
a.it=(a.it+1)*below(a.it,25);a.sw=.00001<Math.abs(equal(a.it,0))?randint(2):a.sw;a.rx=.00001<Math.abs(a.sw)?.001*randint(1001):randint(2);a.ry=.00001<Math.abs(a.sw)?randint(2):.001*randint(1001);a.tm=.5*a.time+2*a.sample;a.vx=.00001<Math.abs(equal(a.it,0))?a.rx:a.vx+.002*a.sw;a.vy=.00001<Math.abs(equal(a.it,0))?a.ry:a.vy+.002*(1-a.sw);a.x=a.vx;a.y=a.vy;a.tm=1.11+a.sample+2*a.t1;a.flux=.5*Math.sin(a.time);a.fluy=.5*Math.cos(a.time);a.xfade=Math.max(-Math.abs(a.x-.5+a.flux)+1,
0);a.xfade2=Math.max(-Math.abs(a.y-.5+a.fluy)+1,0);a.xfade=.5*(a.xfade2+a.xfade);a.r1=.5+.5*Math.sin(a.tm+0);a.g1=.5+.5*Math.sin(a.tm+2.1);a.b1=.5+.5*Math.sin(a.tm+4.2);a.r=a.r1*a.xfade+a.g1*(1-a.xfade);a.g=a.g1*a.xfade+a.b1*(1-a.xfade);a.b=a.b1*a.xfade+a.r1*(1-a.xfade);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.tic=0;a.slide=0;a.toc=0;a.dsign=0;a.vt=0;a.q6=0;a.bt=0;a.q1=0;a.q5=0;a.mid_avg=0;a.dis=0;a.tt=0;a.my=0;a.tin=0;a.limit=0;a.bass_avg=0;a.vav=0;a.q4=0;a.a=0;a.zm=0;a.mt=0;a.q1sgn=0;a.b=0;a.ra=0;a.tm=0;a.mx=0;a.treb_avg=0;a.sp=0;a.q2=0;a.q3=0;a.rmod=0;a.q7=0;a.rb=0;a.q8=0;
return a;},frame_eqs:function(a){
a.warp=0;a.decay=.999;a.q1=Math.sin(a.time);a.q1sgn=sign(a.q1);a.q1=Math.abs(a.q1);a.q1=pow(a.q1,6);a.q1*=a.q1sgn;a.q1=.4*a.q1+.5;a.q2=.5+.1*Math.sin(.548*a.time);a.tic=Math.min(a.time-a.tin,.1);a.tin=a.time;a.ra=1;a.treb_avg=a.tic*(a.treb_avg*(div(1,a.tic)-a.ra)+a.ra*a.treb);a.mid_avg=a.tic*(a.mid_avg*(div(1,a.tic)-a.ra)+a.ra*a.mid);a.bass_avg=a.tic*(a.bass_avg*(div(1,a.tic)-a.ra)+a.ra*a.bass);a.rb=1;a.vav=a.tic*(a.vav*(div(1,a.tic)-a.rb)+a.rb*(a.bass+a.treb+a.mid)*.33333);
a.tt+=a.tic*a.treb_avg;a.mt+=a.tic*a.mid_avg;a.bt+=a.tic*a.bass_avg;a.vt+=a.tic*(a.treb_avg+a.mid_avg+a.bass_avg)*.33333;a.sp=.1*Math.abs(a.vav-a.slide);a.slide=(.00001<Math.abs(above(a.slide,a.vav))?a.slide-a.tic*a.sp:a.slide+a.tic*a.sp)+(1-a.toc)*a.vav;a.toc=1;a.q3=.3333*(a.treb+a.bass+a.mid);a.q3=a.q3*a.q3*.5+.1;a.q3=Math.min(a.q3,1);a.monitor=div(Math.floor(4*a.q3),4);a.q4=a.mt;a.q5=a.bt;a.cx=a.q1;a.cy=a.q2;a.rmod=.01*(.5*(a.treb_avg+a.mid_avg)-.5*a.bass_avg);a.rmod=.14*pow(div(a.rmod,.02),2);
a.rmod=Math.min(.001,Math.max(a.rmod,-.001));a.rmod*=pow(1.1*Math.sin(a.time),2);a.rot=.8*pow(div(a.rmod,.02),2);a.q6=a.rmod;a.q7=a.slide-below(a.q3,.5)*(6+2*Math.sin(24*a.time))*pow(Math.min(1,2*(.5-a.q3)),5);a.q8=.00001<Math.abs(above(Math.sin(.5*a.time),0))?-1:1;
return a;},pixel_eqs:function(a){
a.tm=div(a.time,a.rad);a.a=a.q1;a.b=a.q2;a.mx=a.x-a.a;a.my=a.y-a.b;a.zm=-.45;a.zm=.00001<Math.abs(above(Math.sin(2.1*a.time),.95))?.45*Math.max(1-.5*a.q3,0):a.zm;a.dis=.70710678*pow(a.mx*a.mx+a.my*a.my,.5);a.rot*=1-a.dis;a.rot=20*a.rot*a.q8;a.limit=.05;a.dx=a.zm*a.mx*a.dis*Math.cos(3.14*a.my)*a.q3;a.dsign=sign(a.dx);a.dx-=Math.max(Math.abs(a.dx)-a.limit,0)*a.dsign;a.dy=a.zm*a.my*a.dis*Math.cos(3.14*a.mx)*a.q3;a.dsign=sign(a.dy);a.dy-=Math.max(Math.abs(a.dy)-a.limit,0)*a.dsign;

return a;}}),
"shifter - feathers (angel wings)_phat_remix relief 2":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.35,"decay":0.95,"echo_zoom":0.999608,"echo_alpha":0.5,"echo_orient":1,"wave_mode":7,"additivewave":1,"modwavealphabyvolume":1,"wave_brighten":0,"darken":1,"invert":1,"wave_a":4.099998,"wave_scale":1.285751,"wave_smoothing":0.63,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":1.331,"zoom":0.999514,"warp":0.01,"wave_r":0.65,"wave_g":0.65,"wave_b":0.65,"ob_size":0.5,"ob_r":0.01,"ib_size":0.26,"mv_a":0},"warp":" shader_body { \n  vec3 ret_1;\n  ret_1 = (texture (sampler_main, uv).xyz * 0.97);\n  ret_1 = (ret_1 - 0.004);\n  vec4 tmpvar_2;\n  tmpvar_2.w = 1.0;\n  tmpvar_2.xyz = ret_1;\n  ret = tmpvar_2.xyz;\n }","comp":" shader_body { \n  vec3 d_1;\n  vec3 ret_2;\n  ret_2 = (texture (sampler_main, uv).xyz + 0.15);\n  vec3 tmpvar_3;\n  tmpvar_3.z = 0.0;\n  tmpvar_3.xy = texsize.zw;\n  vec3 tmpvar_4;\n  tmpvar_4 = (tmpvar_3 * 1.3);\n  ret_2 = (ret_2 * 0.5);\n  ret_2 = (ret_2 + (vec3(3.0, 2.1, 0.9) * (\n    dot (((texture (sampler_blur1, (uv + tmpvar_4.xz)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n   - \n    dot (((texture (sampler_blur1, (uv - tmpvar_4.xz)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n  )));\n  ret_2 = (ret_2 + (vec3(0.6, 1.5, 2.1) * (\n    dot (((texture (sampler_blur1, (uv + tmpvar_4.zy)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n   - \n    dot (((texture (sampler_blur1, (uv - tmpvar_4.zy)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n  )));\n  vec2 tmpvar_5;\n  tmpvar_5.x = (1.0 - uv.x);\n  tmpvar_5.y = uv.y;\n  ret_2 = (ret_2 + texture (sampler_main, tmpvar_5).xyz);\n  vec3 tmpvar_6;\n  tmpvar_6.z = 0.0;\n  tmpvar_6.xy = texsize.zw;\n  d_1 = (tmpvar_6 * 1.3);\n  ret_2 = (ret_2 * 0.5);\n  ret_2 = (ret_2 + (vec3(3.0, 2.1, 0.9) * (\n    dot (((texture (sampler_blur1, (tmpvar_5 - d_1.xz)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n   - \n    dot (((texture (sampler_blur1, (tmpvar_5 + d_1.xz)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n  )));\n  ret_2 = (ret_2 + (vec3(0.6, 1.5, 2.1) * (\n    dot (((texture (sampler_blur1, (tmpvar_5 + d_1.zy)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n   - \n    dot (((texture (sampler_blur1, (tmpvar_5 - d_1.zy)).xyz * scale1) + bias1), vec3(0.32, 0.49, 0.29))\n  )));\n  ret_2 = (ret_2 * 1.5);\n  vec4 tmpvar_7;\n  tmpvar_7.w = 1.0;\n  tmpvar_7.xyz = ret_2;\n  ret = tmpvar_7.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"spectrum":1,"thick":1}},{init_eqs:function(a){
a.xang=0;a.fov=0;a.yang=0;a.my=0;a.oz=0;a.ayang=0;a.mz=0;a.oy=0;a.mod=0;a.azang=0;a.mx=0;a.vol=0;a.sp=0;a.zang=0;a.axang=0;a.ox=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.sp=1607.68*a.sample;a.vol=.33*(a.bass_att+a.mid_att+a.treb_att);a.vol=.2+.5*(a.value1+a.value2);a.vol=.2;a.mod=.00001<Math.abs(below(a.mid_att,1.8))?a.mid_att+.2:2;a.ox=.5*Math.sin(a.sp)*Math.sin(3.14*a.sample)*a.vol;a.oy=(a.sample-0)*a.mod;a.oz=.5*Math.cos(a.sp)*Math.sin(3.14*a.sample)*a.vol;a.xang=.672*a.time;a.axang=0;a.yang=-1.351*a.time;a.ayang=0;a.zang=-.401*a.time;a.azang=0;a.fov=.6+.2*Math.sin(a.time);a.fov=.5;a.mx=a.ox*Math.cos(a.zang)-a.oy*Math.sin(a.zang);a.my=
a.ox*Math.sin(a.zang)+a.oy*Math.cos(a.zang);a.ox=a.mx;a.oy=a.my;a.mx=a.ox*Math.cos(a.yang)+a.oz*Math.sin(a.yang);a.mz=-a.ox*Math.sin(a.yang)+a.oz*Math.cos(a.yang);a.ox=a.mx;a.oz=a.mz;a.my=a.oy*Math.cos(a.xang)-a.oz*Math.sin(a.xang);a.mz=a.oy*Math.sin(a.xang)+a.oz*Math.cos(a.xang);a.oy=a.my;a.oz=a.mz;a.oz=Math.abs(a.oz)-2;a.x=div(a.ox*a.fov,a.oz)+.5;a.x=.75*(a.x-.5)+.5;a.y=div(a.oy*a.fov,a.oz)+.5;a.r=1-Math.sin(a.sp);a.b=.5-.5*Math.sin(1.57*a.sample);a.g=.5-.5*Math.cos(1.57*a.sample);a.a=.5+.25*(a.oz+
2);
return a;}}),Object.assign({"baseVals":{"enabled":1,"spectrum":1,"thick":1}},{init_eqs:function(a){
a.xang=0;a.fov=0;a.yang=0;a.my=0;a.oz=0;a.ayang=0;a.mz=0;a.oy=0;a.mod=0;a.azang=0;a.mx=0;a.vol=0;a.sp=0;a.zang=0;a.axang=0;a.ox=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.sp=1607.68*a.sample;a.vol=.33*(a.bass_att+a.mid_att+a.treb_att);a.vol=.2+.5*(a.value1+a.value2);a.vol=.2;a.mod=.00001<Math.abs(below(a.bass_att,1.8))?a.bass_att+.2:2;a.ox=.5*Math.sin(a.sp)*Math.sin(3.14*a.sample)*a.vol;a.oy=(a.sample-0)*a.mod;a.oz=.5*Math.cos(a.sp)*Math.sin(3.14*a.sample)*a.vol;a.xang=-.321*a.time;a.axang=0;a.yang=1.531*a.time;a.ayang=0;a.zang=-.101*a.time;a.azang=0;a.fov=.6+.2*Math.sin(a.time);a.fov=.5;a.mx=a.ox*Math.cos(a.zang)-a.oy*Math.sin(a.zang);a.my=
a.ox*Math.sin(a.zang)+a.oy*Math.cos(a.zang);a.ox=a.mx;a.oy=a.my;a.mx=a.ox*Math.cos(a.yang)+a.oz*Math.sin(a.yang);a.mz=-a.ox*Math.sin(a.yang)+a.oz*Math.cos(a.yang);a.ox=a.mx;a.oz=a.mz;a.my=a.oy*Math.cos(a.xang)-a.oz*Math.sin(a.xang);a.mz=a.oy*Math.sin(a.xang)+a.oz*Math.cos(a.xang);a.oy=a.my;a.oz=a.mz;a.oz=Math.abs(a.oz)-2;a.x=div(a.ox*a.fov,a.oz)+.5;a.x=.75*(a.x-.5)+.5;a.y=div(a.oy*a.fov,a.oz)+.5;a.g=1-Math.sin(a.sp);a.r=.5-.5*Math.sin(1.57*a.sample);a.b=.5-.5*Math.cos(1.57*a.sample);a.a=.5+.25*(a.oz+
2);
return a;}}),Object.assign({"baseVals":{"enabled":1,"spectrum":1,"thick":1}},{init_eqs:function(a){
a.xang=0;a.fov=0;a.yang=0;a.my=0;a.oz=0;a.ayang=0;a.mz=0;a.oy=0;a.mod=0;a.azang=0;a.mx=0;a.vol=0;a.sp=0;a.zang=0;a.axang=0;a.ox=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.sp=1607.68*a.sample;a.vol=.33*(a.bass_att+a.mid_att+a.treb_att);a.vol=.2+.5*(a.value1+a.value2);a.vol=.2;a.mod=.00001<Math.abs(below(a.treb_att,1.8))?a.treb_att+.2:2;a.ox=.5*Math.sin(a.sp)*Math.sin(3.14*a.sample)*a.vol;a.oy=(a.sample-0)*a.mod;a.oz=.5*Math.cos(a.sp)*Math.sin(3.14*a.sample)*a.vol;a.xang=.221*a.time;a.axang=0;a.yang=-.411*a.time;a.ayang=0;a.zang=1.201*a.time;a.azang=0;a.fov=.6+.2*Math.sin(a.time);a.fov=.5;a.mx=a.ox*Math.cos(a.zang)-a.oy*Math.sin(a.zang);a.my=
a.ox*Math.sin(a.zang)+a.oy*Math.cos(a.zang);a.ox=a.mx;a.oy=a.my;a.mx=a.ox*Math.cos(a.yang)+a.oz*Math.sin(a.yang);a.mz=-a.ox*Math.sin(a.yang)+a.oz*Math.cos(a.yang);a.ox=a.mx;a.oz=a.mz;a.my=a.oy*Math.cos(a.xang)-a.oz*Math.sin(a.xang);a.mz=a.oy*Math.sin(a.xang)+a.oz*Math.cos(a.xang);a.oy=a.my;a.oz=a.mz;a.oz=Math.abs(a.oz)-2;a.x=div(a.ox*a.fov,a.oz)+.5;a.x=.75*(a.x-.5)+.5;a.y=div(a.oy*a.fov,a.oz)+.5;a.b=1-Math.sin(a.sp);a.g=.5-.5*Math.sin(1.57*a.sample);a.r=.5-.5*Math.cos(1.57*a.sample);a.a=.5+.25*(a.oz+
2);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.it=0;a.radm=0;a.mod=0;
return a;},frame_eqs:function(a){
a.wave_a=0;a.decay=.995;
return a;},pixel_eqs:function(a){
a.it=.3*Math.sin(.2*a.time);a.radm=.5*a.rad;a.rot=.02*Math.sin(30*(a.radm+a.it))*a.rad;a.mod=Math.sin(5*a.ang);a.mod*=a.mod*a.mod*a.mod*a.mod;a.zoom=1+Math.abs(.01*a.mod);
return a;}}),
"Stahlregen & Boz + Eo.S + Geiss + Phat + Rovastar + Zylot - Machine Code [Jelly]":()=>Object.assign({"baseVals":{"rating":2,"gammaadj":1.14,"decay":1,"echo_zoom":1.002,"echo_orient":1,"wave_mode":4,"wave_thick":1,"wave_a":1.577,"wave_scale":0.01,"wave_smoothing":0,"wave_mystery":-0.24,"modwavealphastart":0.5,"modwavealphaend":1,"warpanimspeed":32.544,"warpscale":9.738,"warp":0.01,"wave_r":0.5,"wave_g":0.5,"wave_b":0.5,"wave_y":0,"ob_size":0.005,"ob_r":0.01,"ob_a":0.6,"ib_size":0.26,"mv_x":16,"mv_y":16.8,"mv_l":0.15,"mv_g":0,"mv_b":0,"mv_a":0},"pixel_eqs":"","warp":" shader_body { \n  vec3 tmpvar_1;\n  tmpvar_1 = max (texture (sampler_fc_main, uv).xyz, (texture (sampler_fc_main, mix (uv, uv_orig, vec2(0.33, 0.33))).xyz * 0.95));\n  vec2 x_2;\n  x_2 = (uv - uv_orig);\n  vec4 tmpvar_3;\n  tmpvar_3.w = 1.0;\n  tmpvar_3.xyz = (((\n    mix (tmpvar_1, (floor((\n      (tmpvar_1 * vec3(7.0, 6.0, 8.0))\n     + 0.25)) / vec3(7.0, 6.0, 8.0)), vec3(0.1, 0.1, 0.1))\n   * 0.995) - 0.001) - ((1.0 - \n    clamp ((sqrt(dot (x_2, x_2)) * 40.0), 0.0, 1.0)\n  ) * 0.002));\n  ret = tmpvar_3.xyz;\n }","comp":" shader_body { \n  vec2 uv2_1;\n  vec3 ret_2;\n  uv2_1 = (uv + (vec2(1.0, 0.0) * texsize.zw));\n  float tmpvar_3;\n  tmpvar_3 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(-1.0, 0.0) * texsize.zw));\n  float tmpvar_4;\n  tmpvar_4 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, 1.0) * texsize.zw));\n  float tmpvar_5;\n  tmpvar_5 = (((texture (sampler_main, uv2_1).xyz + \n    (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4)\n  ) + (\n    ((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2)\n   * 0.15)) + ((\n    (texture (sampler_blur3, uv2_1).xyz * scale3)\n   + bias3) * 0.1)).x;\n  uv2_1 = (uv + (vec2(0.0, -1.0) * texsize.zw));\n  vec3 tmpvar_6;\n  tmpvar_6.z = 0.14;\n  tmpvar_6.x = (tmpvar_3 - tmpvar_4);\n  tmpvar_6.y = (tmpvar_5 - ((\n    (texture (sampler_main, uv2_1).xyz + (((texture (sampler_blur1, uv2_1).xyz * scale1) + bias1) * 0.4))\n   + \n    (((texture (sampler_blur2, uv2_1).xyz * scale2) + bias2) * 0.15)\n  ) + (\n    ((texture (sampler_blur3, uv2_1).xyz * scale3) + bias3)\n   * 0.1)).x);\n  ret_2 = (0.5 + (0.5 * normalize(tmpvar_6)));\n  vec2 x_7;\n  x_7 = (ret_2.xy - 0.5);\n  ret_2 = (ret_2 * clamp ((\n    sqrt(dot (x_7, x_7))\n   * 5.0), 0.0, 1.0));\n  ret_2 = ret_2.xxy;\n  ret_2 = (ret_2 + 1.15);\n  ret_2 = (ret_2 * mix (ret_2, (ret_2 * \n    (((texture (sampler_blur3, uv).xyz * scale3) + bias3) - ((texture (sampler_blur1, uv).xyz * scale1) + bias1))\n  ), pow (hue_shader.zxy, ret_2)));\n  ret_2 = (ret_2 * ret_2);\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_2;\n  ret = tmpvar_8.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.red_rand=0;a.blue_rand=0;
return a;},frame_eqs:function(a){
a.dy-=.0085;a.red_rand=randint(100);a.blue_rand=randint(100);a.wave_r=.01*a.red_rand+.2*Math.sin(1.311*a.time);a.wave_b=.01*a.blue_rand-.2*Math.sin(1.46*a.time);a.wave_g=1-.5*(a.wave_r+a.wave_b)+.2*Math.cos(.789*a.time);
return a;},pixel_eqs:''}),
"Stahlregen & flexi + Geiss + Rovastar + Shifter - Fractal Feedback (for Hexcollie)":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.9,"echo_zoom":1.169,"wave_mode":6,"additivewave":1,"wave_thick":1,"modwavealphabyvolume":1,"wave_brighten":0,"wave_a":4.224,"wave_scale":3.672,"wave_smoothing":0.666,"wave_mystery":0.1,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpanimspeed":0.037,"warpscale":0.015,"warp":0.033,"wave_r":0.1,"wave_g":0.1,"wave_b":0.1,"ob_size":0.005,"ob_a":1,"ib_size":0.005,"ib_r":0,"ib_g":1,"ib_b":0,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.5,"mv_g":0.5,"mv_b":0.5,"mv_a":0},"warp":" shader_body { \n  vec2 my_uv_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = ((uv - 0.5) * vec2((1.0 + q1)));\n  vec2 tmpvar_3;\n  tmpvar_3.x = ((tmpvar_2.x * tmpvar_2.x) - (tmpvar_2.y * tmpvar_2.y));\n  tmpvar_3.y = ((2.0 * tmpvar_2.x) * tmpvar_2.y);\n  vec2 tmpvar_4;\n  tmpvar_4.x = ((tmpvar_3.x * -0.12) - (tmpvar_3.y * 0.74));\n  tmpvar_4.y = ((tmpvar_3.x * 0.74) + (-0.12 * tmpvar_3.y));\n  vec2 tmpvar_5;\n  tmpvar_5.x = ((tmpvar_3.x * (tmpvar_4.x + 1.0)) + (tmpvar_3.y * tmpvar_4.y));\n  tmpvar_5.y = ((tmpvar_3.y * (tmpvar_4.x + 1.0)) - (tmpvar_3.x * tmpvar_4.y));\n  my_uv_1 = (tmpvar_5 * (1.0/((\n    ((tmpvar_4.x + 1.0) * (tmpvar_4.x + 1.0))\n   + \n    (tmpvar_4.y * tmpvar_4.y)\n  ))));\n  vec4 tmpvar_6;\n  tmpvar_6.w = 1.0;\n  tmpvar_6.xyz = (texture (sampler_fc_main, (my_uv_1 - floor(my_uv_1))) * 0.94).xyz;\n  ret = tmpvar_6.xyz;\n }","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":1,"x":0.37,"rad":3,"ang":3.64425,"r":0,"a":0.5,"g2":0,"a2":0.3,"border_a":1}},{init_eqs:function(a){
a.t1=0;a.t2=0;a.t1=.01*randint(100);a.t2=.01*randint(100);
return a;},frame_eqs:function(a){
a.ang=a.time*(.3+.1*a.t1);a.rad*=.9+.2*a.t2;a.r=Math.min(1,Math.max(0,a.r+.2*Math.sin(.417*a.time+1)));a.g=Math.min(1,Math.max(0,a.g+.2*Math.sin(.391*a.time+2)));a.b=Math.min(1,Math.max(0,a.b+.2*Math.sin(.432*a.time+4)));a.r2=Math.min(1,Math.max(0,a.r2+.2*Math.sin(.657*a.time+3)));a.g2=Math.min(1,Math.max(0,a.g2+.2*Math.sin(.737*a.time+5)));a.b2=Math.min(1,Math.max(0,a.b2+.2*Math.sin(.884*a.time+6)));
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":5,"additive":1,"textured":1,"x":0.37,"rad":0.70653,"ang":3.64425,"g":1,"b":1,"a":0.8,"r2":1,"b2":1,"border_a":0}},{init_eqs:function(a){
a.t1=0;a.t2=0;a.t1=.01*randint(100);a.t2=.01*randint(100);
return a;},frame_eqs:function(a){
a.x+=.05*Math.sin(1.25*a.time+3);a.y+=.03*Math.sin(1.49*a.time+1);a.ang=a.time*(.3+.1*a.t1);a.rad*=.9+.2*a.t2;a.r=Math.min(1,Math.max(0,a.r+.1*Math.sin(.417*a.time+1)));a.g=Math.min(1,Math.max(0,a.g+.1*Math.sin(.391*a.time+2)));a.b=Math.min(1,Math.max(0,a.b+.1*Math.sin(.432*a.time+4)));a.r2=Math.min(1,Math.max(0,a.r2+.1*Math.sin(.457*a.time+3)));a.g2=Math.min(1,Math.max(0,a.g2+.1*Math.sin(.437*a.time+5)));a.b2=Math.min(1,Math.max(0,a.b2+.1*Math.sin(.484*a.time+6)));
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":5,"additive":1,"textured":1,"x":0.67,"y":0.43,"rad":0.70653,"ang":4.20974,"g":1,"b":1,"a":0.8,"r2":1,"b2":1,"border_a":0}},{init_eqs:function(a){
a.t1=0;a.t2=0;a.t1=.01*randint(100);a.t2=.01*randint(100);
return a;},frame_eqs:function(a){
a.x+=.05*Math.sin(2.17*a.time);a.y+=.03*Math.sin(1.83*a.time);a.ang=a.time*(.3+.1*a.t1);a.rad*=.9+.2*a.t2;a.r=Math.min(1,Math.max(0,a.r+.1*Math.sin(.417*a.time+1)));a.g=Math.min(1,Math.max(0,a.g+.1*Math.sin(.391*a.time+2)));a.b=Math.min(1,Math.max(0,a.b+.1*Math.sin(.432*a.time+4)));a.r2=Math.min(1,Math.max(0,a.r2+.1*Math.sin(.457*a.time+3)));a.g2=Math.min(1,Math.max(0,a.g2+.1*Math.sin(.437*a.time+5)));a.b2=Math.min(1,Math.max(0,a.b2+.1*Math.sin(.484*a.time+6)));
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":6,"rad":0.16122,"r":0.56,"g":1,"g2":0,"b2":1,"border_r":0,"border_g":0,"border_b":0,"border_a":1}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.x+=.2*Math.sin(1.14*a.time);a.y+=.1*Math.sin(.93*a.time+2);
return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.q25=0;a.star=0;a.cys=0;a.meanbass_att=0;a.q29=0;a.q1=0;a["var"]=0;a.flip=0;a.lastbeat=0;a.beatrate=0;a.mode=0;a.q31=0;a.q23=0;a.q24=0;a.peakbass_att=0;a.beatcounter=0;a.zm=0;a.rdd=0;a.q26=0;a.att=0;a.ag=0;a.volume=0;a.beat=0;a.vol=0;a.q27=0;a.q32=0;a.q7=0;a.angadv=0;a.q28=0;a.q30=0;a.mtime=0;a.q8=0;a.tbr=0;a.mv_x=64;a.mv_y=48;a.nut=0;a.stp=0;a.stq=0;a.rtp=0;a.rtq=0;a.wvr=0;a.decay=0;a.dcsp=0;a.warp=0;
return a;},frame_eqs:function(a){
a.zoom=1;a.volume=.3*(a.bass+a.mid+a.att);a.beatrate=equal(a.beatrate,0)+(1-equal(a.beatrate,0))*(below(a.volume,.01)+(1-below(a.volume,.01))*a.beatrate);a.lastbeat+=equal(a.lastbeat,0)*a.time;a.meanbass_att=.1*(9*a.meanbass_att+a.bass_att);a.peakbass_att=Math.max(a.bass_att,a.peakbass_att);a.beatrate=Math.max(.00001<Math.abs(a.beat)?.00001<Math.abs(below(a.time-a.lastbeat,2*a.beatrate))?.1*(9*a.beatrate+a.time-a.lastbeat):a.beatrate:a.beatrate,.1);a.peakbass_att=a.beat*a.bass_att+
(1-a.beat)*a.peakbass_att*(.95*above(a.time-a.lastbeat,2*a.beatrate)+.995*(1-above(a.time-a.lastbeat,2*a.beatrate)));a.lastbeat=a.beat*a.time+(1-a.beat)*a.lastbeat;a.peakbass_att=Math.max(a.peakbass_att,1.1*a.meanbass_att);a.beat=above(a.volume,.8)*below(a.peakbass_att-a.bass_att,.05*a.peakbass_att)*above(a.time-a.lastbeat,.1+.5*(a.beatrate-.1));a.beatcounter+=a.beat;a.mode=.00001<Math.abs(a.beat*equal(mod(a.beatcounter,2),0))?1-a.mode:a.mode;a.flip=2*a.mode-1;a.monitor=a.flip;a.q8=a.flip;a.angadv+=
a.beat;a.angadv=.00001<Math.abs(above(a.angadv,5))?2:a.angadv;a.q7=a.angadv;a.decay=.95;a.zoom=1.002;a.vol=.25*(a.bass_att+a.mid_att+a.treb_att);a.vol*=a.vol;a.mtime+=.1*a.vol*a.flip*div(37,a.fps);a.q1=.4*a.mtime;a.warp=0;a.cx=.4*Math.sin(.2*a.mtime)+.5;a.cy=Math.sin(.33*a.mtime);a.cys=sign(a.cy);a.cy=a.cy*a.cy*a.cys;a.cy=.4*a.cy+.5;a.rot=.31*Math.sin(.25*a.time);a.q23=div(randint(1E3),1E3);a.q24=div(randint(1E3),1E3);a.q25=6.28*div(randint(1E3),1E3);a.q26=a.q25-3.14;a.q27=div(randint(1E3),8E3)+.1;
a.q28=div(randint(1E3),1E3);a.q29=div(randint(1E3),1E3);a.q30=6.28*div(randint(1E3),1E3);a.q31=a.q30-3.14;a.q32=div(randint(1E3),8E3)+.1;
return a;},pixel_eqs:function(a){
a.tbr=.7+.3*a.treb;a["var"]=-1.5*a.tbr;a.ag=1.75*Math.atan(div(a.y-.5-(a.cy-.5),a.x-.5-(a.cx-.5)));a.star=Math.sin(a.ang*a.q7)*a.tbr;a.rdd=4*Math.max(Math.abs(a.x-.5),Math.abs(a.y-.5));a.zm=1+div(a.rdd,40)+div(a["var"],40)+.003*a.star;a.sx=.8;a.sy=a.sx;
return a;}}),
"Stahlregen - Dots (Pixels - Blocky) (Jelly V2)":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1.65,"decay":0.985,"echo_zoom":1.069,"echo_alpha":0.5,"wrap":0,"brighten":1,"invert":1,"wave_a":0.001,"warpanimspeed":5.278,"warpscale":0.01,"zoomexp":1.12682,"zoom":1.0406,"warp":0.01,"ob_size":0.005,"mv_a":0},"pixel_eqs":"","warp":"","comp":" shader_body { \n  vec3 ret_1;\n  vec2 tmpvar_2;\n  tmpvar_2 = (texsize.zw * 8.0);\n  vec2 tmpvar_3;\n  tmpvar_3.x = (((texture (sampler_blur1, \n    (uv + (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(1.0, 0.0) * tmpvar_2))\n  ).xyz * scale1) + bias1)).y;\n  tmpvar_3.y = (((texture (sampler_blur1, \n    (uv + (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1) - ((texture (sampler_blur1, \n    (uv - (vec2(0.0, 1.0) * tmpvar_2))\n  ).xyz * scale1) + bias1)).y;\n  vec2 tmpvar_4;\n  tmpvar_4 = (uv + (tmpvar_3 * 0.55));\n  vec3 tmpvar_5;\n  tmpvar_5 = mix (ret_1, (1.0 - ret_1), ((0.7 * \n    ((texture (sampler_blur1, tmpvar_4).xyz * scale1) + bias1)\n  ) + (0.2 * texture (sampler_main, uv).xyz)));\n  vec3 tmpvar_6;\n  tmpvar_6 = mix (tmpvar_5, ((\n    (tmpvar_5 - (0.1 * ((texture (sampler_blur3, tmpvar_4).xyz * scale3) + bias3)))\n   + \n    (0.1 * ((texture (sampler_blur1, (\n      (tmpvar_4 * 1.25)\n     - 0.125)).xyz * scale1) + bias1))\n  ) + (0.42 * texture (sampler_main, tmpvar_4).xyz)), vec3(0.25, 0.25, 0.25));\n  vec3 x_7;\n  x_7 = (tmpvar_6 - 0.5);\n  ret_1 = (tmpvar_6 * clamp ((\n    sqrt(dot (x_7, x_7))\n   * 5.0), 0.0, 1.0));\n  ret_1 = (vec3(dot (ret_1, vec3(0.32, 0.49, 0.29))) + 1.25);\n  ret_1 = (ret_1 * (ret_1 * 0.45));\n  ret_1 = (ret_1 * mix (ret_1, (\n    (1.3 * ret_1)\n   * \n    ((((texture (sampler_blur3, uv).xyz * scale3) + bias3) - ((texture (sampler_blur1, uv).xyz * scale1) + bias1)) - (0.25 * ((texture (sampler_blur2, tmpvar_4).xyz * scale2) + bias2)))\n  ), pow (hue_shader.zxy, ret_1)));\n  ret_1 = (ret_1 + 0.03);\n  ret_1 = (ret_1 * ret_1);\n  ret_1 = (ret_1 * hue_shader.zxy);\n  ret_1 = (ret_1 * 1.75);\n  vec4 tmpvar_8;\n  tmpvar_8.w = 1.0;\n  tmpvar_8.xyz = ret_1;\n  ret = tmpvar_8.xyz;\n }"},{shapes:[Object.assign({"baseVals":{"enabled":1,"thickoutline":1,"num_inst":13,"r":0,"b":1,"a":0.6,"g2":0,"b2":0.5,"a2":0.5,"border_a":0.6}},{init_eqs:function(a){
a.q1=0;a.q2=0;
return a;},frame_eqs:function(a){
a.x=a.q1+randint(15)*a.bass_att*.02;a.y=a.q2+randint(15)*a.mid_att*.02;a.rad=.076+.004*randint(11);a.b=.35+.2*Math.sin(.73*a.time)+.001*randint(100);a.b2=.35+.2*Math.sin(.73*a.time)+.001*randint(100);a.g=.55+.125*Math.sin(.43*a.time)+.001*randint(100);a.g2=.55+.125*Math.sin(.43*a.time)+.001*randint(100);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thickoutline":1,"num_inst":14,"rad":0.0999,"r":0,"a":0.6,"g2":0,"a2":0.5,"border_a":0.6}},{init_eqs:function(a){
a.q2=0;a.q1=0;
return a;},frame_eqs:function(a){
a.x=a.q2+randint(15)*a.mid_att*.02;a.y=1-a.q1+randint(15)*a.treb_att*.02;a.rad=.076+.004*randint(11);a.r=.4+.2*Math.sin(.53*a.time)+.001*randint(100);a.r2=.4+.2*Math.sin(.53*a.time)+.001*randint(100);a.b=.55+.12*Math.sin(.63*a.time)+.001*randint(100);a.b2=.55+.12*Math.sin(.63*a.time)+.001*randint(100);
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.q1=0;a.q2=0;
return a;},frame_eqs:function(a){
a.q1=.001*randint(1E3);a.q2=.001*randint(1E3);
return a;},pixel_eqs:''}),
"Unchained - Rewop":()=>Object.assign({"baseVals":{"rating":5,"gammaadj":1,"decay":0.94,"echo_zoom":0.9998,"echo_alpha":0.4999,"echo_orient":3,"wave_mode":1,"additivewave":1,"wave_dots":1,"wave_brighten":0,"wave_a":1.254574,"wave_scale":0.45029,"wave_smoothing":0,"zoomexp":1.008151,"zoom":0.659411,"warp":0.01,"wave_r":0.5,"wave_g":0.5,"wave_b":0.5,"ob_size":0.005,"ob_r":1,"ob_a":1,"ib_size":0.005,"ib_r":0,"ib_g":0,"ib_b":0,"ib_a":0.9,"mv_x":64,"mv_y":48,"mv_l":0,"mv_r":0,"mv_g":0.7,"mv_a":0},"warp":"","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.bblock=0;a.grid=0;a.q6=0;a.q1=0;a.q5=0;a.tth=0;a.tblock=0;a.bpulse=0;a.pulse=0;a.mblock=0;a.q4=0;a.mpulse=0;a.mod_state=0;a.bth=0;a.mres=0;a.tpulse=0;a.tres=0;a.le=0;a.ccl=0;a.q2=0;a.bres=0;a.q3=0;a.mth=0;a.q7=0;a.q8=0;
return a;},frame_eqs:function(a){
a.warp=0;a.le=1.5+2*Math.sin(a.bass_att);a.bpulse=band(above(a.le,a.bth),above(a.le-a.bth,a.bblock));a.bblock=a.le-a.bth;a.bth=.00001<Math.abs(above(a.le,a.bth))?a.le+div(114,a.le+10)-7.407:a.bth+div(.07*a.bth,a.bth-12)+.1*below(a.bth,2.7)*(2.7-a.bth);a.bth=.00001<Math.abs(above(a.bth,6))?6:a.bth;a.bres=a.bpulse*Math.sin(a.pulse+.5*a.le)+bnot(a.bpulse)*a.bres;a.le=1.5+2*Math.sin(a.treb_att);a.tpulse=band(above(a.le,a.tth),above(a.le-a.tth,a.tblock));a.tblock=a.le-a.tth;a.tth=
.00001<Math.abs(above(a.le,a.tth))?a.le+div(114,a.le+10)-7.407:a.tth+div(.07*a.tth,a.tth-12)+.1*below(a.tth,2.7)*(2.7-a.tth);a.tth=.00001<Math.abs(above(a.tth,6))?6:a.tth;a.tres=a.tpulse*Math.sin(a.pulse+.5*a.le)+bnot(a.tpulse)*a.tres;a.le=1.5+2*Math.sin(a.mid_att);a.mpulse=band(above(a.le,a.mth),above(a.le-a.mth,a.mblock));a.mblock=a.le-a.mth;a.mth=.00001<Math.abs(above(a.le,a.mth))?a.le+div(114,a.le+10)-7.407:a.mth+div(.07*a.mth,a.mth-12)+.1*below(a.mth,2.7)*(2.7-a.mth);a.mth=.00001<Math.abs(above(a.mth,
6))?6:a.mth;a.mres=a.mpulse*Math.sin(a.pulse+.5*a.le)+bnot(a.mpulse)*a.mres;a.pulse=.00001<Math.abs(above(Math.abs(a.pulse),3.14))?-3.14:a.pulse+.003*(a.bth+a.mth+a.tth);a.q1=a.bres;a.q2=a.tres;a.q3=a.mres;a.q4=Math.sin(a.pulse);a.mod_state=(above(a.q1,0)+above(a.q2,0)+above(a.q3,0))*(1+above(a.q4,0));a.ccl=a.ccl+a.tpulse+a.mpulse-a.bpulse;a.q5=Math.cos(a.pulse*(.5+.1*a.mod_state));a.q6=Math.sin(a.pulse*(.5+pow(.25,a.mod_state)));a.q7=a.mod_state;a.q8=a.ccl;a.ob_r=.5+.5*Math.cos(a.q1+a.q7);a.ob_g=
.5+.5*Math.cos(3.14*a.q2+a.q7);a.ob_b=.5+.5*Math.cos(2*a.q3+Math.sin(.0816*a.time));a.ib_size=.025+.02*a.q2;a.ob_size=.03+.02*a.q3-.002*a.q7;a.wave_r=.5+.5*Math.sin(a.q1*a.q7+2.183*a.time);a.wave_g=.5+.5*Math.sin(3*a.q2+1.211*a.time);a.wave_b=.5+.5*Math.sin(a.q3+1.541*a.time);a.ob_a=.8+.2*a.q2;a.zoom+=.01*a.q4;
return a;},pixel_eqs:function(a){
a.grid=mod(pow(2*Math.sin(a.rad*a.q6*a.q2+a.x*a.y*a.q6*a.q3),1+mod(a.q7,5)),2);a.rot=bnot(a.grid)+a.grid*a.q4;a.sx+=.003*Math.sin((a.q2+.5)*a.x);a.sy+=.003*Math.sin((a.q1+3.4)*a.y);a.zoom+=.11*Math.cos(3.14*a.rad)*a.q4;
return a;}}),
"yin - 250 - Artificial poles of the continuum_Phat′s_Orbit_mix":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1.28,"decay":0.8,"echo_zoom":1,"echo_orient":3,"wave_brighten":0,"brighten":1,"wave_a":0.001,"wave_scale":1.001775,"wave_smoothing":0.9,"modwavealphastart":0.5,"modwavealphaend":1,"warpanimspeed":1.321288,"warpscale":1.986883,"zoomexp":0.8802,"zoom":0.9998,"warp":0.01,"sx":0.9999,"sy":0.9998,"wave_r":0.5,"wave_g":0.5,"wave_b":0.5,"ob_size":0,"ob_r":1,"ob_g":1,"ob_b":0.5,"ob_a":1,"ib_size":0,"ib_r":0,"ib_g":0.3,"ib_b":0,"mv_x":0,"mv_y":0.000001,"mv_l":1,"mv_g":0.91,"mv_b":0.71,"mv_a":0},"pixel_eqs":"","warp":"","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":60,"additive":1,"textured":1,"rad":0.559237,"ang":1.884956,"tex_ang":0.69115,"tex_zoom":2.348658,"g":0.1,"b":1,"a":0.2,"r2":1,"g2":0.05,"b2":0.4,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":60,"additive":1,"textured":1,"rad":1.54304,"ang":6.283185,"tex_ang":6.283185,"tex_zoom":0.305462,"r":0,"g":0.5,"b":0.6,"a":0.4,"g2":0,"a2":0.8,"border_a":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){
a.tex_ang=a.bass;
return a;}}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;}})],waves:[Object.assign({"baseVals":{"enabled":1,"usedots":1,"additive":1,"smoothing":0}},{init_eqs:function(a){
a.s=0;a.xp=0;a.yp=0;a.zp=0;a.t1=0;a.x_screen=0;a.y_screen=0;a.advance=0;
return a;},frame_eqs:function(a){
a.advance+=.005;a.advance=.00001<Math.abs(above(a.advance,2))?0:a.advance;a.t1=a.advance;
return a;},point_eqs:function(a){
a.s=6.28*a.sample;a.xp=Math.sin(a.s)+Math.sin(.34*a.s)+Math.sin(24.3*a.s)+Math.sin(13.8*a.s);a.xp*=.2;a.yp=Math.cos(a.s)+Math.sin(.24*a.s)+Math.cos(17.4*a.s)+Math.sin(37.7*a.s);a.yp*=.2;a.zp=Math.cos(a.s)+Math.cos(5.24*a.s)+Math.cos(47.4*a.s)+Math.cos(27.7*a.s);a.zp*=.25;a.zp=a.zp+1-a.t1;a.zp=.00001<Math.abs(below(a.zp,0))?a.zp+2:a.zp;a.a=1-.5*a.zp;a.zp*=.7;a.x_screen=div(a.xp,a.zp)+.5;a.y_screen=div(a.yp,a.zp)+.5;a.x=a.x_screen;a.y=a.y_screen;a.r=1;a.g=1;a.b=1;
return a;}}),Object.assign({"baseVals":{"enabled":1,"usedots":1,"thick":1,"additive":1,"smoothing":0}},{init_eqs:function(a){
a.bz=0;a.bx=0;a.q1=0;a.by=0;a.ax=0;a.vx=0;a.vy=0;a.vz=0;a.ay=0;a.q2=0;a.q3=0;a.az=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.ax=5*(Math.sin(100*a.sample+1.865)+1)*Math.sin(1884.93*a.sample+3.14*a.sample);a.ay=5*(Math.sin(100*a.sample+5.23)+1)*Math.cos(200*6.2831*a.sample+3.14*a.sample+.1454);a.az=5*(Math.sin(100*a.sample+.234)+1)*Math.sin(400*6.2831*a.sample+3.14*a.sample+1.84);a.bx=a.ax;a.by=a.ay*Math.cos(a.q1)-a.az*Math.sin(a.q1);a.bz=a.ay*Math.sin(a.q1)+a.az*Math.cos(a.q1);a.ax=a.bx*Math.cos(a.q2)-a.bz*Math.sin(a.q2);a.ay=a.by;a.az=a.bx*Math.sin(a.q2)+a.bz*Math.cos(a.q2);a.bx=a.ax*Math.cos(a.q3)-
a.ay*Math.sin(a.q3);a.by=a.ax*Math.sin(a.q3)+a.ay*Math.cos(a.q3);a.bz=a.az;a.vx=a.bx;a.vy=a.by;a.vz=a.bz;a.x=div(a.vx,Math.abs(a.vz-10))+.5;a.y=div(a.vy,Math.abs(a.vz-10))+.5;a.a=.05*above(a.vz,0)*(5-Math.abs(a.az));
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"additive":1,"smoothing":0,"g":0.500001,"b":0.100001}},{init_eqs:function(a){
a.bz=0;a.bx=0;a.q1=0;a.by=0;a.ax=0;a.vx=0;a.vy=0;a.vz=0;a.ay=0;a.t=0;a.q2=0;a.q3=0;a.as=0;a.az=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.t=above(Math.sin(125.662*a.sample+16*a.time),0);a.ax=(1.58+1.5*a.t*Math.abs(a.value1))*Math.cos(6.2831*a.sample);a.ay=1.3*(1.58+1.5*a.t*Math.abs(a.value2))*Math.sin(6.2831*a.sample);a.az=0;a.bx=a.ax;a.by=a.ay*Math.cos(a.q1)-a.az*Math.sin(a.q1);a.bz=a.ay*Math.sin(a.q1)+a.az*Math.cos(a.q1);a.ax=a.bx*Math.cos(a.q2)-a.bz*Math.sin(a.q2);a.ay=a.by;a.az=a.bx*Math.sin(a.q2)+a.bz*Math.cos(a.q2);a.bx=a.ax*Math.cos(a.q3)-a.ay*Math.sin(a.q3);a.by=a.ax*Math.sin(a.q3)+a.ay*Math.cos(a.q3);
a.bz=a.az;a.vx=a.bx;a.vy=a.by;a.vz=a.bz;a.x=div(a.vx,Math.abs(a.vz-10))+.5;a.y=div(a.vy,Math.abs(a.vz-10))+.5;a.as=above(Math.cos(a.q3+1.57)*Math.cos(a.q2)*a.vx+Math.sin(a.q3+1.57)*Math.sin(a.q1)*a.vy+Math.sin(a.q2)*a.vz,0);a.a=a.t*(.07*(1-a.as)+a.as);
return a;}}),Object.assign({"baseVals":{"enabled":1,"thick":1,"additive":1,"smoothing":0,"g":0.5,"b":0.1}},{init_eqs:function(a){
a.bz=0;a.bx=0;a.q1=0;a.by=0;a.ax=0;a.vx=0;a.vy=0;a.vz=0;a.ay=0;a.t=0;a.q2=0;a.q3=0;a.as=0;a.az=0;
return a;},frame_eqs:function(a){

return a;},point_eqs:function(a){
a.t=above(Math.sin(125.662*a.sample+16*a.time),0);a.ax=(1.58+1.5*a.t*Math.abs(a.value1))*Math.cos(6.2831*a.sample);a.ay=0;a.az=1.2*(1.58+1.5*a.t*Math.abs(a.value2))*Math.sin(6.2831*a.sample);a.bx=a.ax;a.by=a.ay*Math.cos(a.q1)-a.az*Math.sin(a.q1);a.bz=a.ay*Math.sin(a.q1)+a.az*Math.cos(a.q1);a.ax=a.bx*Math.cos(a.q2)-a.bz*Math.sin(a.q2);a.ay=a.by;a.az=a.bx*Math.sin(a.q2)+a.bz*Math.cos(a.q2);a.bx=a.ax*Math.cos(a.q3)-a.ay*Math.sin(a.q3);a.by=a.ax*Math.sin(a.q3)+a.ay*Math.cos(a.q3);
a.bz=a.az;a.vx=a.bx;a.vy=a.by;a.vz=a.bz;a.x=div(a.vx,Math.abs(a.vz-10))+.5;a.y=div(a.vy,Math.abs(a.vz-10))+.5;a.as=above(Math.cos(a.q3-1.57)*Math.cos(a.q2)*a.vx+Math.sin(a.q3-1.57)*Math.sin(a.q1)*a.vy+Math.sin(a.q2)*a.vz,0);a.a=a.t*(.07*(1-a.as)+a.as);
return a;}})],init_eqs:function(a){
a.st=0;a.bz=0;a.bx=0;a.q1=0;a.by=0;a.mytime=0;a.ax=0;a.rho=0;a.vx=0;a.vy=0;a.vz=0;a.ay=0;a.theta=0;a.q2=0;a.q3=0;a.phi=0;a.q7=0;a.az=0;a.q8=0;
return a;},frame_eqs:function(a){
a.st=.00001<Math.abs(equal(a.st,0))?a.time-131:a.st;a.mytime=a.time-a.st;a.phi=.125662*(a.mytime+4.564);a.theta=6.2831*(.03*a.mytime+1.54);a.rho=6.2831*Math.abs(Math.sin(0*a.mytime));a.q1=a.phi;a.q2=a.theta;a.q3=a.rho;a.ax=0;a.ay=0;a.az=-30;a.bx=a.ax;a.by=a.ay*Math.cos(a.q1)-a.az*Math.sin(a.q1);a.bz=a.ay*Math.sin(a.q1)+a.az*Math.cos(a.q1);a.ax=a.bx*Math.cos(a.q2)-a.bz*Math.sin(a.q2);a.ay=a.by;a.az=a.bx*Math.sin(a.q2)+a.bz*Math.cos(a.q2);a.bx=a.ax*Math.cos(a.q3)-a.ay*Math.sin(a.q3);
a.by=a.ax*Math.sin(a.q3)+a.ay*Math.cos(a.q3);a.bz=a.az;a.vx=a.bx;a.vy=a.by;a.vz=a.bz;a.q7=div(a.vx,Math.abs(a.vz-10))+.5;a.vy=-a.vy+1;a.q8=div(a.vy,Math.abs(a.vz-10))+.5;a.q7=.00001<Math.abs(1-below(a.vz,0))?-100:a.q7;a.q8=.00001<Math.abs(1-below(a.vz,0))?-100:a.q8;a.monitor=a.mytime;
return a;},pixel_eqs:''}),
"Zylot - Star Ornament":()=>Object.assign({"baseVals":{"rating":0,"gammaadj":1,"decay":0.997,"echo_zoom":0.996629,"echo_orient":1,"wave_thick":1,"wave_brighten":0,"darken":1,"wave_a":0.001185,"wave_scale":0.01,"wave_smoothing":0.27,"wave_mystery":-0.38,"modwavealphastart":0.71,"modwavealphaend":1.3,"warpscale":1.331,"zoom":0.999514,"warp":0.01,"ob_size":0,"ob_r":0.01,"ob_a":1,"ib_size":0,"ib_r":1,"ib_g":1,"ib_b":1,"ib_a":1,"mv_x":64,"mv_y":48,"mv_l":0.85,"mv_r":0.4999,"mv_g":0.4999,"mv_b":0.4999,"mv_a":0},"warp":"","comp":""},{shapes:[Object.assign({"baseVals":{"enabled":1,"sides":3,"rad":0.34,"ang":0.53,"r":0.56,"g":0.36,"r2":0.9,"a2":0.5,"border_a":0}},{init_eqs:function(a){
a.angle=0;a.bassspin=0;a.q1=0;a.q2=0;a.bassspin=0;a.angle=0;
return a;},frame_eqs:function(a){
a.ang=a.angle;a.bassspin=.00001<Math.abs(above(.05*a.bass,a.bassspin))?a.bassspin+.001:a.bassspin-.001;a.bassspin*=above(a.bassspin,0);a.angle+=a.bassspin;a.r=.3*a.bass;a.g=.3*a.treb;a.b=.3*a.mid;a.r2=.8+.2*Math.sin(1.2*a.time);a.g2=.8+.2*Math.sin(.9777*a.time);a.b2=.8+.2*Math.sin(.7005*a.time);a.border_a=1*above(a.bass+a.treb+a.mid,5);a.x=.5+a.q1;a.y=.5+a.q2;
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":100,"additive":1,"textured":1,"rad":0.108073,"g":1,"b":1,"r2":1,"b2":1,"a2":1,"border_a":0}},{init_eqs:function(a){
a.bassspin=0;a.xpos=0;a.ypos=0;a.q1=0;a.q2=0;a.bassspin=0;a.xpos=.25;a.ypos=.25;
return a;},frame_eqs:function(a){
a.bassspin=.00001<Math.abs(above(.05*a.bass,a.bassspin))?a.bassspin+.001:a.bassspin-.001;a.bassspin*=above(a.bassspin,0);a.xpos+=a.bassspin;a.ypos+=a.bassspin;a.x=.5+a.q1+.13*Math.sin(a.xpos);a.y=.5+a.q2+.18*Math.cos(a.ypos);
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":29,"additive":1,"textured":1,"rad":0.105693,"g":1,"b":1,"r2":1,"b2":1,"a2":1,"border_a":0}},{init_eqs:function(a){
a.bassspin=0;a.xpos=0;a.ypos=0;a.q1=0;a.q2=0;a.bassspin=0;a.xpos=2.3;a.ypos=2.3;
return a;},frame_eqs:function(a){
a.bassspin=.00001<Math.abs(above(.05*a.bass,a.bassspin))?a.bassspin+.001:a.bassspin-.001;a.bassspin*=above(a.bassspin,0);a.xpos+=a.bassspin;a.ypos+=a.bassspin;a.x=.5+a.q1+.13*Math.sin(a.xpos);a.y=.5+a.q2+.18*Math.cos(a.ypos);
return a;}}),Object.assign({"baseVals":{"enabled":1,"sides":100,"additive":1,"textured":1,"rad":0.091434,"g":1,"b":1,"r2":1,"b2":1,"a2":1,"border_a":0}},{init_eqs:function(a){
a.bassspin=0;a.xpos=0;a.ypos=0;a.q1=0;a.q2=0;a.bassspin=0;a.xpos=4.5;a.ypos=4.5;
return a;},frame_eqs:function(a){
a.bassspin=.00001<Math.abs(above(.05*a.bass,a.bassspin))?a.bassspin+.001:a.bassspin-.001;a.bassspin*=above(a.bassspin,0);a.xpos+=a.bassspin;a.ypos+=a.bassspin;a.x=.5+a.q1+.13*Math.sin(a.xpos);a.y=.5+a.q2+.18*Math.cos(a.ypos);
return a;}})],waves:[Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''}),Object.assign({"baseVals":{"enabled":0}},{init_eqs:function(a){

return a;},frame_eqs:function(a){

return a;},point_eqs:''})],init_eqs:function(a){
a.xpos=0;a.yamptarg=0;a.ydir=0;a.q1=0;a.yaccel=0;a.xamptarg=0;a.xamp=0;a.xspeed=0;a.ypos=0;a.xaccel=0;a.att=0;a.vol=0;a.q2=0;a.yamp=0;a.xdir=0;a.yspeed=0;
return a;},frame_eqs:function(a){
a.warp=0;a.decay=.92;a.vol=div(a.bass+a.mid+a.att,6);a.xamptarg=.00001<Math.abs(equal(mod(a.frame,15),0))?Math.min(.5*a.vol*a.bass_att,.5):a.xamptarg;a.xamp+=.5*(a.xamptarg-a.xamp);a.xdir=.00001<Math.abs(above(Math.abs(a.xpos),a.xamp))?-sign(a.xpos):.00001<Math.abs(below(Math.abs(a.xspeed),.1))?2*above(a.xpos,0)-1:a.xdir;a.xaccel=a.xdir*a.xamp-a.xpos-.055*a.xspeed*below(Math.abs(a.xpos),a.xamp);a.xspeed=a.xspeed+a.xdir*a.xamp-a.xpos-.055*a.xspeed*below(Math.abs(a.xpos),a.xamp);
a.xpos+=.001*a.xspeed;a.yamptarg=.00001<Math.abs(equal(mod(a.frame,15),0))?Math.min(.3*a.vol*a.treb_att,.5):a.yamptarg;a.yamp+=.5*(a.yamptarg-a.yamp);a.ydir=.00001<Math.abs(above(Math.abs(a.ypos),a.yamp))?-sign(a.ypos):.00001<Math.abs(below(Math.abs(a.yspeed),.1))?2*above(a.ypos,0)-1:a.ydir;a.yaccel=a.ydir*a.yamp-a.ypos-.055*a.yspeed*below(Math.abs(a.ypos),a.yamp);a.yspeed=a.yspeed+a.ydir*a.yamp-a.ypos-.055*a.yspeed*below(Math.abs(a.ypos),a.yamp);a.ypos+=.001*a.yspeed;a.q1=a.ypos;a.q2=a.xpos;
return a;},pixel_eqs:function(a){
a.zoom+=a.q1*a.q2*2;a.rot=10+a.rad*a.treb*.1;
return a;}})
};
