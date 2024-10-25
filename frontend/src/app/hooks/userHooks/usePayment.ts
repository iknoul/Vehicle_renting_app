import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import apolloClient from '../../../../apollo/apolloClient';
import { CREATE_PAYMENT_MUTATION, VERIFY_PAYMENT_MUTATION } from '../../Services/graphql/mutations/paymentMutations';
import { delay } from '@/app/utils/addDelay';

const PAYMENT_SERVICE_KEY = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_KEY;

interface RazorpayResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

interface Payment {
    tempPeriodId: string;
}

const usePayment = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [paymentData, setPaymentData] = useState<{ razorpay_order_id: string; razorpay_payment_id: string } | undefined>(undefined);

    const [createPayment] = useMutation(CREATE_PAYMENT_MUTATION, {
        client: apolloClient,
        onError: (err) => {
            console.error('Error during create payment:', err);
        },
    });
    const [verifyPayment] = useMutation(VERIFY_PAYMENT_MUTATION, {
        client: apolloClient,
        onError: (err) => {
            console.error('Error during verify payment:', err);
        },
    });

    useEffect(() => {
        // This will run whenever success or paymentData is updated
        console.log(success, paymentData, 'Updated success, paymentData');
    }, [success, paymentData]);

    const initiatePayment = async (tempPeriodId: string): Promise<RazorpayResponse> => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const { data } = await createPayment({
                variables: {
                    tempPeriodId,
                },
            });

            const { orderId, amount: orderAmount } = data.createPayment;

            // Start Razorpay payment process
            return await new Promise<RazorpayResponse>((resolve, reject) => {
                const options = {
                    key: PAYMENT_SERVICE_KEY,
                    amount: orderAmount,
                    currency: 'INR',
                    name: 'Premium LIMO',
                    description: 'Do not refresh this page, it will automatically redirect.',
                    order_id: orderId,
                    handler: (response: RazorpayResponse) => {
                        resolve(response);
                    },
                    modal: {
                        analytics: false,
                    },
                    theme: {
                        color: 'rgba(208, 180, 42, 0.947)',
                    },
                    prefill: {
                        name: 'Your Name',
                        email: 'customer@example.com',
                        contact: '1234567890',
                    },
                };

                if (window.Razorpay) {
                    const paymentObject = new window.Razorpay(options);
                    paymentObject.open();
                } else {
                    setError('Razorpay SDK not loaded');
                    reject(new Error('Razorpay SDK not loaded'));
                }
            });
        } catch (error) {
            console.error('Error initiating payment:', error);
            setError('Payment initiation failed.');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const verifyPaymentHandler = async (response: RazorpayResponse, tempPeriodId: string): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
            await verifyPayment({
                variables: {
                    orderId: response.razorpay_order_id,
                    paymentId: response.razorpay_payment_id,
                    signature: response.razorpay_signature,
                    tempPeriodId,
                },
            });

            setSuccess(true);
            setPaymentData(response);
            await delay(1000);
        } catch (verificationError) {
            console.error('Payment verification failed:', verificationError);
            setError('Payment verification failed.');
            throw verificationError;
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentFlow = async (tempPeriodId: string) => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const response = await initiatePayment(tempPeriodId);
            await verifyPaymentHandler(response, tempPeriodId);
            setPaymentData(response)
            alert('only noe the data')
        } catch (error) {
            console.error('Payment flow error:', error);
        } finally {
            setLoading(false);
        }
    };

    return {
        handlePaymentFlow,
        paymentData,
        loading,
        error,
        success,
    };
};

export default usePayment;
