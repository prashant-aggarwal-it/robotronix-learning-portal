export type EnquiryCategory={id:string;label:string;active:boolean;sortOrder:number};
export type EnquiryPreferences={mode:"simple"|"advanced";categories:EnquiryCategory[]};
