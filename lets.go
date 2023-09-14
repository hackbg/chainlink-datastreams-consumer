package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/pkg/errors"
	mercuryutils "github.com/smartcontractkit/chainlink/v2/core/services/relay/evm/mercury/utils"
	v1report "github.com/smartcontractkit/chainlink/v2/core/services/relay/evm/mercury/v1/types"
	v2report "github.com/smartcontractkit/chainlink/v2/core/services/relay/evm/mercury/v2/types"
	v3report "github.com/smartcontractkit/chainlink/v2/core/services/relay/evm/mercury/v3/types"
)

type SingleReport struct {
	FeedID                []byte `json:"feedID"`
	ValidFromTimestamp    uint32 `json:"validFromTimestamp"`
	ObservationsTimestamp uint32 `json:"observationsTimestamp"`
	FullReport            []byte `json:"fullReport"`
}

type SingleReportResponse struct {
	Report SingleReport `json:"report"`
}

type BulkReportResponse struct {
	Reports []SingleReport `json:"reports"`
}

var baseUrl = "api.testnet-dataengine.chain.link" //Example: https://api.testnet-dataengine.chain.link

const (
	path     = "/api/v1/reports"
	bulkPath = "/api/v1/reports/bulk"
)

func GenerateHMAC(method string, path string, body []byte, clientId string, timestamp int64, userSecret string) string {
	serverBodyHash := sha256.New()
	serverBodyHash.Write(body)
	serverBodyHashString := fmt.Sprintf("%s %s %s %s %d",
		method,
		path,
		hex.EncodeToString(serverBodyHash.Sum(nil)),
		clientId,
		timestamp)
	fmt.Println("Generating HMAC with the following:  ", serverBodyHashString)
	signedMessage := hmac.New(sha256.New, []byte(userSecret))
	signedMessage.Write([]byte(serverBodyHashString))
	userHmac := hex.EncodeToString(signedMessage.Sum(nil))
	return userHmac
}

func GenerateAuthHeaders(method string, pathAndParams string, clientId string, userSecret string) http.Header {
	header := http.Header{}
	timestamp := time.Now().UTC().UnixMilli()
	hmacString := GenerateHMAC(method, pathAndParams, []byte(""), clientId, timestamp, userSecret)

	header.Add("Authorization", clientId)
	header.Add("X-Authorization-Timestamp", strconv.FormatInt(timestamp, 10))
	header.Add("X-Authorization-Signature-SHA256", hmacString)
	return header
}

func FetchSingleReportSingleFeed() (SingleReport, error) {
	clientId := "16678a93-e5a2-424d-98da-47793460bc4d"                                                                                               // Example: "00000000-0000-0000-0000-000000000000"
	userSecret := "HX7ALWUkf8s4faD52pNekYMfAzhgHnKPvwVFdyg26SQ2FQ2VMv4gkvFyLs7MXk5BeJ56gwhb5BsN52s6y95daXCrMsNsmmnQJSnjg2ejjFCbXcmHSTyunJhjKyczaCAP" // Example: "your-secret"
	feedId := "0x0002F18A75A7750194A6476C9AB6D51276952471BD90404904211A9D47F34E64"                                                                   // 0x is optional

	params := url.Values{
		"feedID":    {feedId},
		"timestamp": {fmt.Sprintf("%d", 1694212245)},
	}

	req := &http.Request{
		Method: http.MethodGet,
		URL: &url.URL{
			Scheme:   "https",
			Host:     baseUrl,
			Path:     path,
			RawQuery: params.Encode(),
		},
	}
	req.Header = GenerateAuthHeaders(req.Method, req.URL.RequestURI(), clientId, userSecret)

	rawRes, err := http.DefaultClient.Do(req)
	if err != nil {
		return SingleReport{}, err
	}
	defer rawRes.Body.Close()

	body, err := io.ReadAll(rawRes.Body)
	if err != nil {
		return SingleReport{}, err
	}

	if rawRes.StatusCode != http.StatusOK {
		// Error messages are typically descriptive
		return SingleReport{}, fmt.Errorf("unexpected status code %d: %v", rawRes.StatusCode, string(body))
	}

	var res SingleReportResponse
	err = json.Unmarshal(body, &res)
	if err != nil {
		return SingleReport{}, err
	}

	return res.Report, nil
}

func FetchSingleReportManyFeeds() ([]SingleReport, error) {
	clientId := "16678a93-e5a2-424d-98da-47793460bc4d"                                                                                               // Example: "00000000-0000-0000-0000-000000000000"
	userSecret := "HX7ALWUkf8s4faD52pNekYMfAzhgHnKPvwVFdyg26SQ2FQ2VMv4gkvFyLs7MXk5BeJ56gwhb5BsN52s6y95daXCrMsNsmmnQJSnjg2ejjFCbXcmHSTyunJhjKyczaCAP" // Example: "your-secret"
	feedIds := []string{
		"0x00023496426B520583AE20A66D80484E0FC18544866A5B0BFEE15EC771963274", // 0x is optional
		"0x0003CF04AE2C77770E7C1847D388C725F4D916220E38F9637F6A8FCB4F97AE43",
	}

	params := url.Values{
		"feedIDs":   {strings.Join(feedIds, ",")},
		"timestamp": {fmt.Sprintf("%d", 1694212245)},
	}

	req := &http.Request{
		Method: http.MethodGet,
		URL: &url.URL{
			Scheme:   "https",
			Host:     baseUrl,
			Path:     bulkPath,
			RawQuery: params.Encode(),
		},
	}

	req.Header = GenerateAuthHeaders(req.Method, req.URL.RequestURI(), clientId, userSecret)
	rawRes, err := http.DefaultClient.Do(req)
	if err != nil {
		return []SingleReport{}, err
	}
	defer rawRes.Body.Close()

	body, err := io.ReadAll(rawRes.Body)
	if err != nil {
		return []SingleReport{}, err
	}

	if rawRes.StatusCode != http.StatusOK {
		// Error messages are typically descriptive
		return []SingleReport{}, fmt.Errorf("unexpected status code %d: %v", rawRes.StatusCode, string(body))
	}

	var res BulkReportResponse
	err = json.Unmarshal(body, &res)
	if err != nil {
		return []SingleReport{}, err
	}

	return res.Reports, nil
}

type ReportWithContext struct {
	FeedId      mercuryutils.FeedID
	FeedVersion mercuryutils.FeedVersion
	V1Report    *v1report.Report
	V2Report    *v2report.Report
	V3Report    *v3report.Report
	Round       uint8
	Epoch       uint32
	Digest      []byte
}

type FullReport struct {
	ReportContext [3][32]byte
	ReportBlob    []byte
	RawRs         [][32]byte
	RawSs         [][32]byte
	RawVs         [32]byte
}

func mustNewType(t string) abi.Type {
	result, err := abi.NewType(t, "", []abi.ArgumentMarshaling{})
	if err != nil {
		panic(fmt.Sprintf("Unexpected error during abi.NewType: %s", err))
	}
	return result
}

var schema = abi.Arguments{
	{Name: "reportContext", Type: mustNewType("bytes32[3]")},
	{Name: "reportBlob", Type: mustNewType("bytes")},
	{Name: "rawRs", Type: mustNewType("bytes32[]")},
	{Name: "rawSs", Type: mustNewType("bytes32[]")},
	{Name: "rawVs", Type: mustNewType("bytes32")},
}

/*
	DecodeFullReport reads the "fullReport" from the API response into a struct containing the report context, report data,
	and raw signatures. This functions requires no prep to use, because the schema for the "fullReport" blob is
	common among all report versions (basic, premium, etc),
*/

func DecodeFullReport(fullReport []byte) (*FullReport, error) {
	values, err := schema.Unpack(fullReport)
	if err != nil {
		return nil, fmt.Errorf("failed to decode FullReport: %w", err)
	}
	decoded := new(FullReport)
	if err = schema.Copy(decoded, values); err != nil {
		return nil, fmt.Errorf("failed to copy FullReport values to struct: %w", err)
	}

	return decoded, nil
}

/*
DecodeReportData takes the report blob (FullReport.ReportBlob), extracts the feeds id, calculates the version from the feed id,
and finally decodes the report blob using the lib that correlates with the version. The resulting interface can be cast into
the correct report type as needed.
*/
func DecodeReportData(reportBlob []byte) (mercuryutils.FeedID, interface{}, error) {
	feedIdAbi := abi.Arguments{
		{Name: "feedId", Type: mustNewType("bytes32")},
	}
	reportElements := map[string]interface{}{}
	if err := feedIdAbi.UnpackIntoMap(reportElements, reportBlob); err != nil {
		return mercuryutils.FeedID{}, nil, err
	}
	feedIdInterface, ok := reportElements["feedId"]
	if !ok {
		return mercuryutils.FeedID{}, nil, errors.Errorf("unpacked ReportBlob has no 'feedId'")
	}
	feedIdBytes, ok := feedIdInterface.([32]byte)
	if !ok {
		return mercuryutils.FeedID{}, nil, errors.Errorf("cannot cast ReportBlob feedId to [32]byte, type is %T", feedIdBytes)
	}
	feedID := mercuryutils.FeedID(feedIdBytes)

	switch feedID.Version() {
	case mercuryutils.REPORT_V1: // Legacy/Backward compatible report. Most customers won't use this.
		res, err := v1report.Decode(reportBlob)
		return feedID, res, err // Cast to v1report.Report
	case mercuryutils.REPORT_V2: // Basic report
		res, err := v2report.Decode(reportBlob)
		return feedID, res, err // Cast to v2report.Report
	case mercuryutils.REPORT_V3: // Premium report
		res, err := v3report.Decode(reportBlob)
		return feedID, res, err // Cast to v3report.Report
	default:
		return mercuryutils.FeedID{}, nil, errors.Errorf("unknown report version %d", feedID.Version())
	}
}

/*
DecodeFullReportAndReportData takes the full report payload, decodes the fullReport blob, and then decodes the report data.
*/
func DecodeFullReportAndReportData(payload []byte) (*ReportWithContext, error) {
	fullReport, err := DecodeFullReport(payload)
	if err != nil {
		return nil, err
	}

	feedID, report, err := DecodeReportData(fullReport.ReportBlob)
	if err != nil {
		return nil, err
	}

	result := &ReportWithContext{
		FeedId:      feedID,
		FeedVersion: feedID.Version(),
		Digest:      fullReport.ReportContext[0][:],
		Round:       fullReport.ReportContext[1][31],
		Epoch:       binary.BigEndian.Uint32(fullReport.ReportContext[1][32-5 : 32-1]),
	}

	switch feedID.Version() {
	case mercuryutils.REPORT_V1:
		result.V1Report = report.(*v1report.Report)
	case mercuryutils.REPORT_V2:
		result.V2Report = report.(*v2report.Report)
	case mercuryutils.REPORT_V3:
		result.V3Report = report.(*v3report.Report)
	default:
		return nil, errors.Errorf("unknown report version %d", feedID.Version())
	}

	return result, nil
}

var reportWithQuoteSchema = &abi.Arguments{
	{Name: "reportContext", Type: mustNewType("bytes32[3]")},
	{Name: "report", Type: mustNewType("bytes")},
	{Name: "rawRs", Type: mustNewType("bytes32[]")},
	{Name: "rawSs", Type: mustNewType("bytes32[]")},
	{Name: "rawVs", Type: mustNewType("bytes32")},
	{Name: "quote", Type: mustNewType("bytes")},
}

func PreparePayloadForOnChainVerification(fullReport []byte) ([]byte, error) {
	values, err := DecodeFullReport(fullReport)
	if err != nil {
		panic(err)
	}

	arbitrumLinkAddr := common.HexToAddress("0x0001f9d6939b4fdf6ebdba9ebe02405427659c40343105464e82facd2dcbb0af")

	return reportWithQuoteSchema.Pack(
		values.ReportContext,
		values.ReportBlob,
		values.RawRs,
		values.RawSs,
		values.RawVs,
		arbitrumLinkAddr,
	)
}

func main() {
	fullReportData, err := FetchSingleReportSingleFeed()
	if err != nil {
		fmt.Println("error:", err)
	}
	report, err := DecodeFullReportAndReportData(fullReportData.FullReport)
	if err != nil {
		fmt.Println("error:", err)
	}
	result, err := json.MarshalIndent(report, "", " ")
	if err != nil {
		fmt.Println("error:", err)
	}
	fmt.Print(string(result))
	// fmt.Printf("%+v\n", report)
}
