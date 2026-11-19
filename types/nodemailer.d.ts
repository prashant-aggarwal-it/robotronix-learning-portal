declare module "nodemailer" {
 const nodemailer: {createTransport(options:Record<string,unknown>):{verify():Promise<boolean>;sendMail(message:Record<string,unknown>):Promise<{accepted:string[];messageId:string}>;close():void}};
 export default nodemailer;
}
