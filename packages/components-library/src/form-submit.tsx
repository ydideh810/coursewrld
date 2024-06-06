import React, { ReactNode } from "react";
import { Submit } from "@radix-ui/react-form";
import Button from "./button";

interface FormSubmitProps {
    text: ReactNode;
    [key: string]: any;
}

export default function FormSubmit({ text, ...other }: FormSubmitProps) {
    return (
        <Submit asChild>
            <Button component="button" {...other}>
                {text}
            </Button>
        </Submit>
    );
}
