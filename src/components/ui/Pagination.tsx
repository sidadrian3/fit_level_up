import React from "react";
import { Button } from "./Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const renderPages = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(
                <Button
                    key={i}
                    variant={currentPage === i ? "primary" : "outline"}
                    onClick={() => onPageChange(i)}
                    className={`w-10 h-10 p-0 flex items-center justify-center ${
                        currentPage === i ? "pointer-events-none" : ""
                    }`}
                >
                    {i}
                </Button>
            );
        }
        return pages;
    };

    return (
        <div className="flex items-center justify-center space-x-2 mt-6">
            <Button
                variant="outline"
                className="px-2 h-10 w-10 flex items-center justify-center p-0"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                aria-label="Previous page"
            >
                <ChevronLeft size={18} />
            </Button>

            <div className="flex items-center space-x-1">
                {renderPages()}
            </div>

            <Button
                variant="outline"
                className="px-2 h-10 w-10 flex items-center justify-center p-0"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                aria-label="Next page"
            >
                <ChevronRight size={18} />
            </Button>
        </div>
    );
}
