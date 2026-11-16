/** Both flight modes share normalized commands; manual input revokes autopilot. */
export function resolveFlightCommand({automaticCommand=null,manualCommand=null}={}){
 const valid=c=>c&&['x','y','z'].every(k=>Number.isFinite(c[k])&&c[k]>=-1&&c[k]<=1);
 if(valid(manualCommand))return {source:'manual',command:{...manualCommand},cancelAutopilot:true};
 if(valid(automaticCommand))return {source:'automatic',command:{...automaticCommand},cancelAutopilot:false};
 return {source:'idle',command:{x:0,y:0,z:0},cancelAutopilot:false};
}
