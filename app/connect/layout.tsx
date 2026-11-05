import type {Metadata} from "next";
import "./connect.css";

export const metadata:Metadata={
 title:"Connect CRM | Robotronix",
 description:"Robotronix Connect — enquiries, contacts and follow-ups.",
 robots:{index:false,follow:false},
};

export default function ConnectLayout({children}:{children:React.ReactNode}){
 return <>{children}</>;
}
