import type {Metadata} from "next";
import type {ReactNode} from "react";
import "./v2/v2.css";
import "./collaboration.css";
import "./settings/settings.css";
import "./v2/connected/connected.css";
import "./ui-polish.css";
import "./product-experience.css";
export const metadata:Metadata={title:"My Tasks | Robotronix",description:"Your personal tasks, focus and connected work"};
export default function TasksLayout({children}:{children:ReactNode}){return children;}
