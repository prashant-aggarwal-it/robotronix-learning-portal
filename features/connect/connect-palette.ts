/** Stable semantic palette shared by Robotronix Connect screens. */
export type ConnectTone="new"|"contacted"|"trial"|"won"|"lost"|"overdue"|"completed"|"scheduled"|"cancelled"|"neutral";
const COLORS:Record<ConnectTone,string>={
 new:"#168bca",contacted:"#12a39e",trial:"#e79a35",won:"#149979",lost:"#cb6270",
 overdue:"#c6801d",completed:"#149979",scheduled:"#168bca",cancelled:"#cb6270",neutral:"#7e95a7"
};
export const CHANNEL_COLORS:Record<string,string>={
 whatsapp:"#138bc6",instagram:"#18a6a2",email:"#ed9d3c",facebook:"#617ee9",
 website:"#7294aa",website_form:"#7294aa",phone:"#849fb4",unknown:"#94a8b8"
};
export function channelColor(source:string):string{
 return CHANNEL_COLORS[source.trim().toLowerCase().replace(/[\s-]+/g,"_")]||"#7899ae";
}
export function stageTone(stage:string|null|undefined,outcome?:string|null):ConnectTone{
 if(outcome==="won"||outcome==="lost")return outcome;
 const name=(stage||"").trim().toLowerCase();
 if(/\b(won|enrolled|converted|successful|admitted)\b/.test(name))return "won";
 if(/\b(lost|rejected|closed lost|not interested)\b/.test(name))return "lost";
 if(/\b(trial|counsel|consult|demo|assessment|interview)\b/.test(name))return "trial";
 if(/\b(contacted|qualified|follow.up|discussion|negotiat)\b/.test(name))return "contacted";
 if(/\b(new|inquiry|enquiry|unreviewed)\b/.test(name))return "new";
 return "neutral";
}
export function toneColor(tone:ConnectTone):string{return COLORS[tone];}
