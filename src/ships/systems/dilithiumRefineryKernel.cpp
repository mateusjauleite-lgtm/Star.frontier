#include <algorithm>
#include <cmath>
namespace{double c(double v,double a,double b){return std::max(a,std::min(b,v));}bool p(double v){return std::isfinite(v)&&v>0;}}
extern "C" int dilithium_refinery_step(double dt,double raw,double buf,double core,double rc,double bc,double cc,double rr,double tr,int on,int transfer,double*out){
 if(!out||!std::isfinite(dt)||!std::isfinite(raw)||!std::isfinite(buf)||!std::isfinite(core)||!p(rc)||!p(bc)||!p(cc)||!p(rr)||!p(tr))return 0;
 dt=c(dt,0,.1);raw=c(raw,0,rc);buf=c(buf,0,bc);core=c(core,0,cc);double refined=0,moved=0;
 if(on&&dt>0){refined=std::min({raw,bc-buf,rr*dt});raw-=refined;buf+=refined;}
 if(transfer&&dt>0){moved=std::min({buf,cc-core,tr*dt});buf-=moved;core+=moved;}
 out[0]=raw;out[1]=buf;out[2]=core;out[3]=refined;out[4]=moved;out[5]=dt?refined/dt:0;out[6]=dt?moved/dt:0;return 1;
}