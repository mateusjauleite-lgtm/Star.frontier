#include <cmath>
#include <limits>
namespace {
bool valid_state(const double* p, const double* v, double mu, double dt) {
  if (!p || !v || !std::isfinite(mu) || mu <= 0.0 || !std::isfinite(dt) || dt <= 0.0) return false;
  for (int i=0;i<3;i++) if (!std::isfinite(p[i]) || !std::isfinite(v[i])) return false;
  const double r2=p[0]*p[0]+p[1]*p[1]+p[2]*p[2];
  return std::isfinite(r2) && r2>0.0;
}
void acceleration(const double* p,double mu,double* out) {
  const double r2=p[0]*p[0]+p[1]*p[1]+p[2]*p[2];
  const double inv=1.0/(r2*std::sqrt(r2));
  for(int i=0;i<3;i++) out[i]=-mu*p[i]*inv;
}
}
extern "C" {
double ship_gravity_acceleration_component(double x,double y,double z,double mu,int axis) {
  if(axis<0||axis>2||!std::isfinite(mu)||mu<=0.0) return std::numeric_limits<double>::quiet_NaN();
  const double p[3]={x,y,z}; const double r2=x*x+y*y+z*z;
  if(!std::isfinite(r2)||r2<=0.0) return std::numeric_limits<double>::quiet_NaN();
  return -mu*p[axis]/(r2*std::sqrt(r2));
}
// Velocity-Verlet: position m, velocity m/s, mu m^3/s^2, dt s.
int ship_integrate_orbit_step(double* p,double* v,double mu,double dt) {
  if(!valid_state(p,v,mu,dt)) return 0;
  double a0[3],a1[3],next[3]; acceleration(p,mu,a0);
  for(int i=0;i<3;i++) next[i]=p[i]+v[i]*dt+0.5*a0[i]*dt*dt;
  acceleration(next,mu,a1);
  for(int i=0;i<3;i++){v[i]+=0.5*(a0[i]+a1[i])*dt;p[i]=next[i];}
  return 1;
}
}
