/// <reference types="vite/client" />
import "appwrite";

declare module "appwrite" {
  namespace Models {
    interface Document {
      [key: string]: any;
    }
  }
}
