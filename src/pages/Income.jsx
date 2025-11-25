import Dashboard from "../components/Dashboard";
import { useUser } from "../hooks/useUser";
import { useEffect, useState } from "react";
import axiosConfig from "../util/axiosConfig";
import { API_ENDPOINTS } from "../util/apiEndpoints";
import toast from "react-hot-toast";
import IncomeList from "../components/IncomeList";
import Modal from "../components/Modal";
import AddIncomeForm from "../components/AddIncomeForm";
import DeleteAlert from "../components/DeleteAlert";
import IncomeOverview from "../components/IncomeOverview";

const Income = () => {
    useUser();
    const [incomeData, setIncomeData] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    const [openAddIncomeModal, setOpenAddIncomeModal] = useState(false);
    const [openDeleteAlert, setOpenDeleteAlert] = useState({
        show: false,
        data: null,
    });

    // Fetch income details from the API
    const fetchIncomeDetails = async () => {
    if (loading) return;

    setLoading(true);

    try {
        const response = await axiosConfig.get(API_ENDPOINTS.GET_ALL_INCOMES);

        if (response.status === 200) {
            // auto-detect correct array
            const incomeArray =
                response.data?.data ||    // if backend returns { data: [...] }
                response.data?.incomes || // if backend returns { incomes: [...] }
                response.data || [];      // if backend directly returns [...]

            setIncomeData(incomeArray);
        }
    } catch (error) {
        console.error('Failed to fetch income details:', error);
        toast.error(error.response?.data?.message || "Failed to fetch income details");
    } finally {
        setLoading(false);
    }
}


    // Fetch categories for income
    const fetchIncomeCategories = async () => {
        try {
            const response = await axiosConfig.get(API_ENDPOINTS.CATEGORY_BY_TYPE("income"));
            if (response.status === 200) {
                console.log('income categories', response.data);
                setCategories(response.data);
            }
        } catch (error) {
            console.log('Failed to fetch income categories:', error);
            toast.error(error.response?.data?.message || "Failed to fetch income categories");
        }
    }

    // Save the income details
    const handleAddIncome = async (income) => {
        console.log('📝 Adding income:', income);
        const { name, amount, date, icon, categoryId } = income;

        // Validation
        if (!name.trim()) {
            toast.error("Please enter a name");
            return;
        }

        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            toast.error("Amount should be valid number greater than 0");
            return;
        }

        if (!date) {
            toast.error("Please select a date");
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        if (date > today) {
            toast.error("Date cannot be in the future");
            return;
        }

        if (!categoryId) {
            toast.error("Please select a category");
            return;
        }

        try {
            console.log('🚀 Sending to API:', {
                name,
                amount: Number(amount),
                date,
                icon,
                categoryId,
            });
            
            const response = await axiosConfig.post(API_ENDPOINTS.ADD_INCOME, {
                name,
                amount: Number(amount),
                date,
                icon,
                categoryId,
            })
            
            console.log('✅ API Response:', response);
            
            if (response.status === 201) {
                setOpenAddIncomeModal(false);
                toast.success("Income added successfully");
                fetchIncomeDetails();
                fetchIncomeCategories();
            }
        } catch (error) {
            console.log('❌ Error adding income:', error);
            console.log('❌ Error response:', error.response);
            toast.error(error.response?.data?.message || "Failed to add income");
        }
    }

    // Delete income details
    const deleteIncome = async (id) => {
        try {
            await axiosConfig.delete(API_ENDPOINTS.DELETE_INCOME(id));
            setOpenDeleteAlert({ show: false, data: null });
            toast.success("Income deleted successfully");
            fetchIncomeDetails();
        } catch (error) {
            console.log('Error deleting income', error);
            toast.error(error.response?.data?.message || "Failed to delete income");
        }
    }

    // Download income details as Excel
    const handleDownloadIncomeDetails = async () => {
        let loadingToast;
        try {
            // Show loading toast
            loadingToast = toast.loading("Downloading income details...");
            
            const response = await axiosConfig.get(
                API_ENDPOINTS.INCOME_EXCEL_DOWNLOAD, 
                { 
                    responseType: "blob",
                    timeout: 30000 // 30 seconds
                }
            );
            
            // Dismiss loading toast
            toast.dismiss(loadingToast);
            
            // Check if response is actually a blob
            if (!(response.data instanceof Blob)) {
                throw new Error("Invalid response format");
            }
            
            // Get filename from Content-Disposition header or use default
            let filename = "income_details.xlsx";
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }
            
            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            toast.success("Income details downloaded successfully");

        } catch (error) {
            // Dismiss loading toast if it exists
            if (loadingToast) {
                toast.dismiss(loadingToast);
            }
            
            console.error('Error downloading income details:', error);

            // Handle blob error responses
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const errorData = JSON.parse(text);
                    toast.error(errorData.message || "Failed to download income details");
                } catch (parseError) {
                    toast.error("Failed to download income details");
                }
            } else if (error.response?.data?.message) {
                toast.error(error.response.data.message);
            } else if (error.code === 'ECONNABORTED') {
                toast.error("Download timeout - please try again");
            } else if (!error.response) {
                toast.error("Network error - please check your connection");
            } else {
                toast.error("Failed to download income details");
            }
        }
    }

    // Email income details
    const handleEmailIncomeDetails = async () => {
        try {
            const response = await axiosConfig.get(API_ENDPOINTS.EMAIL_INCOME);
            if (response.status === 200) {
                toast.success("Income details emailed successfully");
            }
        } catch (error) {
            console.error('Error emailing income details:', error);
            toast.error(error.response?.data?.message || "Failed to email income");
        }
    }

    useEffect(() => {
        fetchIncomeDetails();
        fetchIncomeCategories();
    }, []);

    return (
        <Dashboard activeMenu="Income">
            <div className="my-5 mx-auto">
                <div className="grid grid-cols-1 gap-6">
                    <div>
                        {/* Overview for income with line chart */}
                        <IncomeOverview 
                            transactions={incomeData} 
                            onAddIncome={() => setOpenAddIncomeModal(true)} 
                        />
                    </div>

                    <IncomeList 
                        transactions={incomeData} 
                        onDelete={(id) => setOpenDeleteAlert({ show: true, data: id })}
                        onDownload={handleDownloadIncomeDetails}
                        onEmail={handleEmailIncomeDetails}
                    />

                    {/* Add Income Modal */}
                    <Modal
                        isOpen={openAddIncomeModal}
                        onClose={() => setOpenAddIncomeModal(false)}
                        title="Add Income"
                    >
                        <AddIncomeForm
                            onAddIncome={(income) => handleAddIncome(income)}
                            categories={categories}
                        />
                    </Modal>

                    {/* Delete Income Modal */}
                    <Modal
                        isOpen={openDeleteAlert.show}
                        onClose={() => setOpenDeleteAlert({ show: false, data: null })}
                        title="Delete Income"
                    >
                        <DeleteAlert
                            content="Are you sure you want to delete this income details?"
                            onDelete={() => deleteIncome(openDeleteAlert.data)}
                        />
                    </Modal>
                </div>
            </div>
        </Dashboard>
    );
};

export default Income;