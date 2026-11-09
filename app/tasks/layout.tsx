import type {Metadata} from "next";
import "./tasks.css";
export const metadata:Metadata={title:"My Tasks | Robotronix",description:"Your private productivity space"};
export default function TasksLayout({children}:{children:React.ReactNode}){return children;}
