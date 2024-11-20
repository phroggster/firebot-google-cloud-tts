import consts from "../consts";

// A high-level, minimally-functional, untested GitHub releases REST API wrapper
// See: https://docs.github.com/en/rest/releases/releases

type ReactionData = {
  url: string;
  total_count: number;
  confused: number;
  eyes: number;
  heart: number;
  hooray: number;
  laugh: number;
  rocket: number;
  "+1": number;
  "-1": number;
};
type AuthorData = {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string | null;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  email?: string | null;
  name?: string | null;
  starred_at?: string;
};
type AssetData = {
  url: string;
  id: number;
  node_id: string;
  /** The file name of the asset. */
  name: string;
  label: string | null;
  uploader: AuthorData | null;
  content_type: string;
  /** State of the release asset. */
  state: "uploaded" | "open";
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
};
type ReleaseData = {
  /** The REST API URL to the release:
   * https://api.github.com/repos/{user}/{repo}/releases/{id}
   */
  url: string;
  /** The REST API URL to the release assets:
   * https://api.github.com/repos/{user}/{repo}/releases/{id}/assets
   */
  assets_url: string;
  /** The URL to the root of the uploaded release assets:
   * https://uploads.github.com/repos/{user}/{repo}/releases/{id}/assets{?name,label}
   */
  upload_url: string;
  /** The URL to the release for display in a web browser:
   * https://github.com/{user}/{repo}/releases/{tag_name}
   */
  html_url: string;
  id: number;
  author: AuthorData;
  node_id: string;
  /** The name of the tag. */
  tag_name: string;
  /** The commitish value which the release was created from. This will
   * generally be the git branch name that the release was created from, but
   * may also be a commit ID, or something else entirely different.
   */
  target_commitish: string;
  name: string | null;
  /** `true` if the release is a draft release; `false` if it is a published
   * release.
   */
  draft: boolean;
  /** `true` if the release is identified as a pre-release; `false` if is
   * considered a "proper" release.
   */
  prerelease: boolean;
  created_at: Date;
  published_at: Date | null;
  assets: AssetData[];
  /** The URL to the released source code tarball asset download:
   * https://api.github.com/repos/{user}/{repo}/tarball/{tag_name}
   */
  tarball_url: string | null;
  /** The URL to the released source code zipball asset download:
   * https://api.github.com/repos/{user}/{repo}/zipball/{tag_name}
   */
  zipball_url: string | null;

  body?: string | null;
  body_html?: string;
  body_text?: string;
  /** The URL of the release discussion. */
  discussion_url?: string;
  mentions_count?: number;
  reactions?: ReactionData;
};
type ErrData = {
  documentation_url?: string | null,
  message?: string | null,
  status: number,
};
type ResponseData<T> = { status: number } & (T | { error: ErrData });

const defaultApiVersion: string = "2022-11-28";
const defaultUserAgent: string =
  `Firebot/v5 firebot-google-tts-revised/${consts.PLUGIN_VERSION}`;

let apiVersion = defaultApiVersion;

async function listReleases (
  user: string,
  repo: string,
  userAgent: string,
  numPerPage: number,
  pageNum: number,
  authToken: string | null,
) : Promise<ResponseData<{ releases: ReleaseData[] }>> {
  if (!user) {
    throw new RangeError("user parameter nullish");
  } else if (!repo) {
    throw new RangeError("repo parameter nullish");
  } else if (!Number.isInteger(numPerPage)) {
    throw new TypeError("numPerPage argument type invalid; got "
      + `${typeof numPerPage}, expected positive integer`);
  } else if (!Number.isInteger(pageNum)) {
    throw new TypeError("pageNum argument type invalid; got "
      + `${typeof pageNum}, expected positive integer`);
  } else if (!Number.isSafeInteger(numPerPage) || numPerPage < 1) {
    throw new RangeError(`numPerPage argument out of range; got ${numPerPage}`
      + ", expected 1 <= numPerPage <= 2^53 - 1");
  } else if (!Number.isSafeInteger(pageNum) || pageNum < 1) {
    throw new RangeError(`pageNum argument out of range; got ${pageNum}`
      + ", expected 1 <= pageNum <= 2^53 - 1");
  }

  user = user !== decodeURIComponent(user) ? user : encodeURIComponent(user);
  repo = repo !== decodeURIComponent(repo) ? repo : encodeURIComponent(repo);
  const reqHeaders = new Headers({
    "Accept": "application/vnd.github+json",
    "User-Agent": userAgent,
    "X-GitHub-Api-Version": apiVersion,
  });
  if (authToken != null) {
    reqHeaders.append("Authorization", `Bearer: ${authToken}`);
  }

  let queryParams: string[] | string = [];
  if (numPerPage !== 30) {
    queryParams.push(`per_page=${numPerPage}`);
  }
  if (pageNum !== 1) {
    queryParams.push(`page=${pageNum}`);
  }
  if (queryParams.length > 0) {
    queryParams = `?${queryParams.join("&")}`;
  } else {
    queryParams = "";
  }

  const uri = `https://api.github.com/repos/${user}/${repo}/releases${queryParams}`;
  const request = new Request(uri, { method: "GET", headers: reqHeaders });
  const response = await fetch(request);
  if (response.headers.get("Content-Type")?.includes("application/json")) {
    const result = await response.json();
    if (response.ok && result) {
      return { releases: result as ReleaseData[], status: response.status };
    } else if (result && result.status !== undefined) {
      return { error: result as ErrData, status: response.status };
    }
  }

  return {
    error: {
      message: response.statusText || "An unknown error occurred",
      status: response.status,
    },
    status: response.status,
  };
};

async function getLatestReleaseInfo(
  user: string,
  repo: string,
  userAgent: string,
  authToken: string | null,
): Promise<ResponseData<{ release: ReleaseData }>> {
  user = user !== decodeURIComponent(user) ? user : encodeURIComponent(user);
  repo = repo !== decodeURIComponent(repo) ? repo : encodeURIComponent(repo);

  const uri = `https://api.github.com/repos/${user}/${repo}/releases/latest`;
  const reqHeaders = new Headers({
    "Accept": "application/vnd.github+json",
    "User-Agent": userAgent,
    "X-GitHub-Api-Version": apiVersion,
  });
  if (authToken != null) {
    reqHeaders.append("Authorization", `Bearer: ${authToken}`);
  }

  const request = new Request(uri, { method: "GET", headers: reqHeaders });
  const response = await fetch(request);
  if (response.headers.get("Content-Type")?.includes("application/json")) {
    const result = await response.json();
    if (response.ok && result) {
      return { release: result as ReleaseData, status: response.status };
    } else if (result && result.status !== undefined) {
      return { error: result as ErrData, status: response.status };
    }
  }

  return {
    error: {
      message: response.statusText || "An unknown error occurred",
      status: response.status,
    },
    status: response.status,
  };
};

export default {
  /** Get the GitHub REST API version identifier being utilized. */
  getApiVersion: (): string => apiVersion,
  /** Set the GitHub REST API version identifier to be utilized. */
  setApiVersion: (version: string | null): void => {
    apiVersion = version || defaultApiVersion;
  },

  /**
   * Get information about the most recent release (excluding pre-releases, and
   * excluding draft releases) published by a GitHub repository.
   * @param user The case-insensitive account owner of the
   * repository.
   * @param repo The case-insensitive name of the repository.
   * @param userAgent The User-Agent header value to send in the request.
   * @param authToken (optional) The Authorization: Bearer token to use to
   * access private repositories.
   * @returns Information about the latest release published in the repository.
   * @see https://docs.github.com/en/rest/releases/releases#get-the-latest-release
   */
  getLatestReleaseInfo: async (
    user: string,
    repo: string,
    userAgent?: string | null,
    authToken?: string | null,
  ) => {
    return await getLatestReleaseInfo(user, repo,
      userAgent || defaultUserAgent, authToken || null);
  },

  /** Get a paginated list of releases (including pre-releases, excluding draft
   * releases) published by a GitHub repository. These should be sorted by
   * release date descending (newest first).
   * @param user The case-insensitive name of the account owner of the
   * repository.
   * @param repo The case-insensitive name of the repository.
   * @param userAgent The User-Agent header value to send in the request.
   * @param numPerPage (optional, default `10`) The number of elements to
   * paginate together per request.
   * @param pageNum (optional, default `1`) The page index of the collection to
   * fetch.
   * @param authToken (optional) The Authorization: Bearer token to use to
   * access private repositories or pending drafts releases.
   * @returns Information about the releases published in the repository.
   * @see https://docs.github.com/en/rest/releases/releases#list-releases
   */
  listReleases: async (
    user: string,
    repo: string,
    userAgent?: string | null,
    numPerPage?: number,
    pageNum?: number,
    authToken?: string | null,
  ) => await listReleases(user, repo, userAgent || defaultUserAgent,
    numPerPage ?? 10, pageNum ?? 1, authToken || null),
};
