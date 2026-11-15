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
bool finite_vector(const double* v) {
  if (!v) return false;
  for (int i=0;i<3;i++) if (!std::isfinite(v[i])) return false;
  return true;
}
double dot3(const double* a,const double* b) {
  return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
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

// Local tangent-frame landing guidance. All distances are metres and all
// velocities are metres/second. This computes a guidance target; it does not
// apply forces or move the rendered ship.
int ship_calculate_landing_guidance(
  const double* position,const double* velocity,const double* target,const double* surface_normal,
  double maximum_descent_speed,double lateral_gain,double vertical_gain,
  double* desired_velocity,double* metrics
) {
  if (!finite_vector(position)||!finite_vector(velocity)||!finite_vector(target)||
      !finite_vector(surface_normal)||!finite_vector(desired_velocity)||!finite_vector(metrics)||
      !std::isfinite(maximum_descent_speed)||maximum_descent_speed<=0.0||
      !std::isfinite(lateral_gain)||lateral_gain<0.0||
      !std::isfinite(vertical_gain)||vertical_gain<0.0) return 0;

  const double normal_length=std::sqrt(dot3(surface_normal,surface_normal));
  if (!std::isfinite(normal_length)||normal_length<=1e-12) return 0;
  double up[3];
  for(int i=0;i<3;i++) up[i]=surface_normal[i]/normal_length;

  double relative[3],lateral[3];
  for(int i=0;i<3;i++) relative[i]=position[i]-target[i];
  const double altitude=dot3(relative,up);
  for(int i=0;i<3;i++) lateral[i]=relative[i]-altitude*up[i];
  const double lateral_distance=std::sqrt(dot3(lateral,lateral));
  const double vertical_velocity=dot3(velocity,up);

  // Positive vertical velocity means rising; negative means descending.
  const double descent=std::fmax(0.0,std::fmin(maximum_descent_speed,
    altitude*vertical_gain-vertical_velocity*0.35));
  double lateral_velocity[3];
  for(int i=0;i<3;i++) lateral_velocity[i]=velocity[i]-vertical_velocity*up[i];

  double lateral_command[3];
  for(int i=0;i<3;i++) lateral_command[i]=-lateral[i]*lateral_gain-lateral_velocity[i]*0.5;
  const double lateral_command_length=std::sqrt(dot3(lateral_command,lateral_command));
  if(lateral_command_length>5.0) {
    const double scale=5.0/lateral_command_length;
    for(int i=0;i<3;i++) lateral_command[i]*=scale;
  }
  for(int i=0;i<3;i++) desired_velocity[i]=lateral_command[i]-up[i]*descent;

  // 0 align, 1 approach, 2 descent, 3 flare.
  const int phase=lateral_distance>8.0?0:(altitude>80.0?1:(altitude>10.0?2:3));
  metrics[0]=altitude;
  metrics[1]=lateral_distance;
  metrics[2]=static_cast<double>(phase);
  return 1;
}
}
