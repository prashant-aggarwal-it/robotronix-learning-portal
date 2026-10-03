import type {TrainerFinanceRecord} from "./types";

// Fictional QA records only. Emails/phones/payment details in demo mode are not real account data.
export const demoTrainerFinance:TrainerFinanceRecord[]=[
 {id:"finance-vikas",trainerId:"vikas",accountHolderName:"Vikas Sharma",bankName:"HDFC Bank",accountNumber:"000000001101",ifsc:"HDFC0000001",upiId:"vikas.qa@upi",preferredPayoutMethod:"bank",paymentModel:"per_class",paymentRate:1200,pan:"ABCDE1234F",complianceStatus:"verified",notes:"QA scenario: verified bank payout profile.",updatedAt:"2026-09-14T08:00:00Z"},
 {id:"finance-shamsher",trainerId:"shamsher",accountHolderName:"Shamsher Singh",bankName:"ICICI Bank",accountNumber:"000000001102",ifsc:"ICIC0000001",upiId:"shamsher.qa@upi",preferredPayoutMethod:"upi",paymentModel:"per_class",paymentRate:1200,pan:"FGHIJ5678K",complianceStatus:"verified",notes:"QA scenario: verified UPI payout profile.",updatedAt:"2026-09-14T08:00:00Z"},
 {id:"finance-arvind",trainerId:"arvind",accountHolderName:"Arvind Kumar",bankName:"",accountNumber:"",ifsc:"",upiId:"arvind.qa@upi",preferredPayoutMethod:"upi",paymentModel:"per_class",paymentRate:1200,pan:"",complianceStatus:"pending",notes:"QA scenario: PAN / bank verification pending.",updatedAt:"2026-09-14T08:00:00Z"},
 {id:"finance-meera",trainerId:"meera",accountHolderName:"Meera Iyer",bankName:"Axis Bank",accountNumber:"000000001104",ifsc:"UTIB0000001",upiId:"meera.qa@upi",preferredPayoutMethod:"bank",paymentModel:"per_class",paymentRate:1350,pan:"KLMNO1234P",complianceStatus:"needs_update",notes:"QA scenario: bank proof needs refresh.",updatedAt:"2026-09-16T08:00:00Z"},
 {id:"finance-nandita",trainerId:"nandita",accountHolderName:"Nandita Rao",bankName:"",accountNumber:"",ifsc:"",upiId:"",preferredPayoutMethod:"other",paymentModel:"per_class",paymentRate:1100,pan:"",complianceStatus:"pending",notes:"QA scenario: new trainer finance setup not completed.",updatedAt:"2026-09-17T08:00:00Z"}
];
